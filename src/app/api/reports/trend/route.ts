import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ipdDailySummary, opdDailyShifts, nursingWards } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { calcOPDProductivity } from '@/lib/opd-calc';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const wardIdStr = searchParams.get('wardId');
        const daysStr = searchParams.get('days') || '14'; 

        if (!wardIdStr) {
            return NextResponse.json({ error: 'Missing wardId parameter' }, { status: 400 });
        }

        const wardId = parseInt(wardIdStr);
        const days = parseInt(daysStr);

        // Calculate date range
        const endDateObj = new Date();
        const endDate = endDateObj.toISOString().split('T')[0];

        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - (days - 1));
        const startDate = startDateObj.toISOString().split('T')[0];

        // Fetch ward info to determine deptType
        const wardInfo = await db.select().from(nursingWards).where(eq(nursingWards.id, wardId)).limit(1);
        if (wardInfo.length === 0) {
            return NextResponse.json({ error: 'Ward not found' }, { status: 404 });
        }

        const deptType = wardInfo[0].deptType;
        const trendData: { date: string; productivity: number }[] = [];

        // Pre-fill array with all dates in range to ensure continuous line chart
        const dateMap: Record<string, number> = {};
        for (let i = 0; i < days; i++) {
            const d = new Date(startDateObj);
            d.setDate(d.getDate() + i);
            dateMap[d.toISOString().split('T')[0]] = 0;
        }

        if (deptType === 'IPD' || deptType === 'BOTH') {
            const ipdData = await db.select({
                recordDate: ipdDailySummary.recordDate,
                productivity: ipdDailySummary.productivity
            })
            .from(ipdDailySummary)
            .where(
                and(
                    eq(ipdDailySummary.wardId, wardId),
                    gte(ipdDailySummary.recordDate, startDate),
                    lte(ipdDailySummary.recordDate, endDate)
                )
            );

            ipdData.forEach(row => {
                if (dateMap[row.recordDate] !== undefined) {
                    dateMap[row.recordDate] = parseFloat(row.productivity as string || '0');
                }
            });
        } 
        
        if (deptType === 'OPD' || deptType === 'ER' || deptType === 'LR' || deptType === 'BOTH') {
             // For BOTH, OPD might overwrite IPD in this basic logic unless told otherwise. 
             // Usually it's either IPD or OPD. For BOTH, let's prioritize OPD if it has data or average them. 
             // To keep it simple, if it's strictly OPD/ER/LR, we calculate it here.
             
             const opdData = await db.select()
             .from(opdDailyShifts)
             .where(
                 and(
                     eq(opdDailyShifts.wardId, wardId),
                     gte(opdDailyShifts.recordDate, startDate),
                     lte(opdDailyShifts.recordDate, endDate)
                 )
             );

             const groupedOpd: Record<string, { workload: number; staff: number; patients: number }> = {};
             
             opdData.forEach(row => {
                 if (!groupedOpd[row.recordDate]) {
                     groupedOpd[row.recordDate] = { workload: 0, staff: 0, patients: 0 };
                 }
                 groupedOpd[row.recordDate].workload += parseFloat(row.workloadScore as string || '0');
                 groupedOpd[row.recordDate].staff += (row.rnCount || 0) + (row.nonRnCount || 0);
                 groupedOpd[row.recordDate].patients += (row.patientTotal || 0);
             });

             Object.entries(groupedOpd).forEach(([date, data]) => {
                 if (dateMap[date] !== undefined) {
                     const prod = calcOPDProductivity(data.workload, data.staff, data.patients);
                     // If deptType is BOTH and IPD already set a value, we can just use OPD or average it.
                     // Here we'll just use OPD since BOTH is rare and usually means it's an OPD unit with some IPD beds.
                     dateMap[date] = prod; 
                 }
             });
        }

        Object.entries(dateMap).forEach(([date, prod]) => {
            trendData.push({ date, productivity: prod });
        });

        // Sort just to be safe
        trendData.sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
            wardId,
            wardName: wardInfo[0].name,
            deptType,
            startDate,
            endDate,
            days,
            data: trendData
        });

    } catch (error: any) {
        console.error('Error fetching trend data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
