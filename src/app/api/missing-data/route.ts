import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ipdDailySummary, opdDailyShifts, nursingWards } from '@/db/schema';
import { eq, or, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetDate = searchParams.get('date');

        if (!targetDate) {
            return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
        }

        // 1. Fetch all active wards
        const activeWards = await db.select({
            id: nursingWards.id,
            name: nursingWards.name,
            deptType: nursingWards.deptType,
        })
        .from(nursingWards)
        .where(eq(nursingWards.isActive, true))
        .orderBy(nursingWards.name);

        // 2. Fetch IPD data for the target date
        // Since IPD has a summary table with 1 row per ward per day, it's easier to check
        const ipdSubmitted = await db.select({ wardId: ipdDailySummary.wardId })
            .from(ipdDailySummary)
            .where(eq(ipdDailySummary.recordDate, targetDate));
        
        const ipdSubmittedIds = new Set(ipdSubmitted.map(w => w.wardId));

        // 3. Fetch OPD data for the target date
        // OPD doesn't have a summary, but if they submitted ANY shift, they are considered active.
        const opdSubmitted = await db.select({ wardId: opdDailyShifts.wardId })
            .from(opdDailyShifts)
            .where(eq(opdDailyShifts.recordDate, targetDate));
        
        const opdSubmittedIds = new Set(opdSubmitted.map(w => w.wardId));

        // 4. Calculate missing wards
        const missingIpd = activeWards.filter(w => 
            (w.deptType === 'IPD' || w.deptType === 'BOTH') && !ipdSubmittedIds.has(w.id)
        );

        const missingOpd = activeWards.filter(w => 
            (w.deptType === 'OPD' || w.deptType === 'ER' || w.deptType === 'LR' || w.deptType === 'BOTH') 
            && !opdSubmittedIds.has(w.id)
        );

        return NextResponse.json({
            date: targetDate,
            missingIpd: missingIpd.map(w => ({ id: w.id, name: w.name })),
            missingOpd: missingOpd.map(w => ({ id: w.id, name: w.name })),
            totalMissing: missingIpd.length + missingOpd.length
        });

    } catch (error: any) {
        console.error('Error fetching missing data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
