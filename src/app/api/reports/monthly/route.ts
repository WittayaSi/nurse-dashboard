import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ipdDailySummary, opdDailyShifts, nursingWards } from '@/db/schema';
import { eq, or, and, gte, lte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const monthStr = searchParams.get('month'); // Expecting YYYY-MM
        const filterDept = searchParams.get('deptType'); // IPD, OPD, or All

        if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
            return NextResponse.json({ error: 'Invalid or missing month parameter (YYYY-MM)' }, { status: 400 });
        }

        // Calculate start and end dates for the month
        const startDate = `${monthStr}-01`;
        const dateObj = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0);
        const endDate = `${monthStr}-${dateObj.getDate().toString().padStart(2, '0')}`;

        // Fetch all active wards
        let wardQuery = db.select({
            id: nursingWards.id,
            name: nursingWards.name,
            deptType: nursingWards.deptType,
        }).from(nursingWards).where(eq(nursingWards.isActive, true));

        const activeWards = await wardQuery;
        
        // Filter wards based on deptType if provided
        const targetWards = activeWards.filter(w => {
           if (!filterDept || filterDept === 'All') return true;
           if (filterDept === 'IPD') return w.deptType === 'IPD' || w.deptType === 'BOTH';
           if (filterDept === 'OPD') return w.deptType === 'OPD' || w.deptType === 'ER' || w.deptType === 'LR' || w.deptType === 'BOTH';
           return true;
        });

        // Object to store aggregated data
        const reportData: Record<number, any> = {};
        
        // Initialize report data
        targetWards.forEach(w => {
            reportData[w.id] = {
                id: w.id,
                name: w.name,
                deptType: w.deptType,
                // IPD metrics
                patientDaySum: 0,
                newAdmissionSum: 0,
                dischargeSum: 0,
                hppdSum: 0,
                cmiSum: 0,
                ipdProductivitySum: 0,
                ipdDaysCount: 0,
                // OPD metrics
                patientTotalSum: 0,
                opdWorkloadSum: 0,
                opdDaysCount: 0
            };
        });

        const targetWardIds = targetWards.map(w => w.id);

        if (targetWardIds.length > 0) {
            // Fetch IPD Summary Data for the month
            if (!filterDept || filterDept === 'All' || filterDept === 'IPD') {
                const ipdData = await db.select()
                    .from(ipdDailySummary)
                    .where(
                        and(
                            gte(ipdDailySummary.recordDate, startDate),
                            lte(ipdDailySummary.recordDate, endDate)
                        )
                    );

                ipdData.forEach(row => {
                    const r = reportData[row.wardId];
                    if (r) {
                        r.patientDaySum += (row.patientDay || 0);
                        r.newAdmissionSum += (row.newAdmission || 0);
                        r.dischargeSum += (row.dischargeCount || 0);
                        r.hppdSum += parseFloat(row.hppd as string || '0');
                        r.cmiSum += parseFloat(row.cmi as string || '0');
                        r.ipdProductivitySum += parseFloat(row.productivity as string || '0');
                        r.ipdDaysCount += 1;
                    }
                });
            }

            // Fetch OPD Shift Data for the month (we aggregate shifts into daily totals, then monthly)
            if (!filterDept || filterDept === 'All' || filterDept === 'OPD') {
                const opdData = await db.select()
                    .from(opdDailyShifts)
                    .where(
                        and(
                            gte(opdDailyShifts.recordDate, startDate),
                            lte(opdDailyShifts.recordDate, endDate)
                        )
                    );
                
                // Track distinct days per ward to calculate averages correctly
                const opdDaysTracker: Record<number, Set<string>> = {};

                opdData.forEach(row => {
                    const r = reportData[row.wardId];
                    if (r) {
                        r.patientTotalSum += (row.patientTotal || 0);
                        // Assuming workloadScore represents productivity for OPD
                        r.opdWorkloadSum += parseFloat(row.workloadScore as string || '0'); 
                        
                        if (!opdDaysTracker[row.wardId]) opdDaysTracker[row.wardId] = new Set();
                        opdDaysTracker[row.wardId].add(row.recordDate);
                    }
                });

                Object.keys(opdDaysTracker).forEach(wardIdStr => {
                    const wId = parseInt(wardIdStr);
                    if (reportData[wId]) {
                        reportData[wId].opdDaysCount = opdDaysTracker[wId].size;
                    }
                });
            }
        }

        // Finalize averages
        const finalizedReport = Object.values(reportData).map((r: any) => {
            return {
                ...r,
                avgHppd: r.ipdDaysCount > 0 ? (r.hppdSum / r.ipdDaysCount).toFixed(2) : '0.00',
                avgCmi: r.ipdDaysCount > 0 ? (r.cmiSum / r.ipdDaysCount).toFixed(2) : '0.00',
                avgIpdProductivity: r.ipdDaysCount > 0 ? (r.ipdProductivitySum / r.ipdDaysCount).toFixed(2) : '0.00',
                avgOpdWorkload: r.opdDaysCount > 0 ? (r.opdWorkloadSum / r.opdDaysCount).toFixed(2) : '0.00',
            };
        });

        return NextResponse.json({
            month: monthStr,
            startDate,
            endDate,
            data: finalizedReport.sort((a, b) => a.name.localeCompare(b.name))
        });

    } catch (error: any) {
        console.error('Error fetching monthly report data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
