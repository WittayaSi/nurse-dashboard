import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { nursingWards, ipdDailyShifts, ipdDailySummary, opdDailyShifts } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

// GET - Aggregated dashboard data
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const deptType = searchParams.get('deptType') || 'IPD';
        const wardId = searchParams.get('wardId');

        // If no date specified, find the latest date with data
        let targetDate = date;
        if (!targetDate) {
            if (deptType === 'IPD') {
                const latest = await db.select({ maxDate: sql<string>`MAX(${ipdDailySummary.recordDate})` })
                    .from(ipdDailySummary);
                targetDate = latest[0]?.maxDate || new Date().toISOString().split('T')[0];
            } else {
                const latest = await db.select({ maxDate: sql<string>`MAX(${opdDailyShifts.recordDate})` })
                    .from(opdDailyShifts);
                targetDate = latest[0]?.maxDate || new Date().toISOString().split('T')[0];
            }
        }

        if (deptType === 'IPD') {
            return NextResponse.json(await getIPDDashboard(targetDate, wardId));
        } else {
            return NextResponse.json(await getOPDDashboard(targetDate, wardId, deptType));
        }
    } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function getIPDDashboard(date: string, wardId: string | null) {
    // Get shift data
    const shiftConditions = [eq(ipdDailyShifts.recordDate, date)];
    if (wardId) shiftConditions.push(eq(ipdDailyShifts.wardId, parseInt(wardId)));

    const shifts = await db.select({
        wardId: ipdDailyShifts.wardId,
        wardName: nursingWards.name,
        shift: ipdDailyShifts.shift,
        hnCount: ipdDailyShifts.hnCount,
        rnCount: ipdDailyShifts.rnCount,
        tnCount: ipdDailyShifts.tnCount,
        naCount: ipdDailyShifts.naCount,
    })
    .from(ipdDailyShifts)
    .leftJoin(nursingWards, eq(ipdDailyShifts.wardId, nursingWards.id))
    .where(and(...shiftConditions));

    // Get summary data
    const summaryConditions = [eq(ipdDailySummary.recordDate, date)];
    if (wardId) summaryConditions.push(eq(ipdDailySummary.wardId, parseInt(wardId)));

    const summaries = await db.select({
        wardId: ipdDailySummary.wardId,
        wardName: nursingWards.name,
        totalStaffDay: ipdDailySummary.totalStaffDay,
        patientDay: ipdDailySummary.patientDay,
        hppd: ipdDailySummary.hppd,
        dischargeCount: ipdDailySummary.dischargeCount,
        newAdmission: ipdDailySummary.newAdmission,
        productivity: ipdDailySummary.productivity,
        cmi: ipdDailySummary.cmi,
        capStatus: ipdDailySummary.capStatus,
    })
    .from(ipdDailySummary)
    .leftJoin(nursingWards, eq(ipdDailySummary.wardId, nursingWards.id))
    .where(and(...summaryConditions));

    // Aggregate shifts
    const shiftTotals = { morning: { hn: 0, rn: 0, tn: 0, na: 0 }, afternoon: { hn: 0, rn: 0, tn: 0, na: 0 }, night: { hn: 0, rn: 0, tn: 0, na: 0 } };
    let totalRN = 0, totalNonRN = 0;

    shifts.forEach(s => {
        const hn = s.hnCount ?? 0;
        const rn = s.rnCount ?? 0;
        const tn = s.tnCount ?? 0;
        const na = s.naCount ?? 0;
        const shiftKey = s.shift as keyof typeof shiftTotals;

        if (shiftTotals[shiftKey]) {
            shiftTotals[shiftKey].hn += hn;
            shiftTotals[shiftKey].rn += rn;
            shiftTotals[shiftKey].tn += tn;
            shiftTotals[shiftKey].na += na;
        }
        totalRN += rn + hn;
        totalNonRN += tn + na;
    });

    // Aggregate summaries
    let totalWorkforce = 0, totalPatientDay = 0, totalProd = 0, totalCMI = 0;
    let prodCount = 0;
    let capSuitable = 0, capImprove = 0, capShortage = 0;
    const wardData: { name: string; prod: number }[] = [];

    summaries.forEach(s => {
        totalWorkforce += s.totalStaffDay ?? 0;
        totalPatientDay += s.patientDay ?? 0;
        const prod = parseFloat(s.productivity ?? '0');
        if (prod > 0) { totalProd += prod; prodCount++; }
        totalCMI += parseFloat(s.cmi ?? '0');

        const cap = (s.capStatus ?? '').toLowerCase();
        if (cap.includes('suitable') || cap.includes('เหมาะสม')) capSuitable++;
        else if (cap.includes('improve') || cap.includes('ปรับปรุง')) capImprove++;
        else if (cap.includes('shortage') || cap.includes('ขาดแคลน')) capShortage++;

        if (s.wardName) {
            wardData.push({ name: s.wardName, prod });
        }
    });

    return {
        date,
        deptType: 'IPD',
        productivity: prodCount > 0 ? parseFloat((totalProd / prodCount).toFixed(2)) : 0,
        totalWorkforce,
        cmi: prodCount > 0 ? parseFloat((totalCMI / prodCount).toFixed(2)) : 0,
        patientVisit: totalPatientDay,
        shifts: {
            morning: { rn: shiftTotals.morning.hn + shiftTotals.morning.rn, nonRn: shiftTotals.morning.tn + shiftTotals.morning.na },
            afternoon: { rn: shiftTotals.afternoon.hn + shiftTotals.afternoon.rn, nonRn: shiftTotals.afternoon.tn + shiftTotals.afternoon.na },
            midnight: { rn: shiftTotals.night.hn + shiftTotals.night.rn, nonRn: shiftTotals.night.tn + shiftTotals.night.na },
        },
        workforce: { rn: totalRN, nonRn: totalNonRN },
        skillMix: {
            total: totalRN + totalNonRN,
            onDuty: totalRN + totalNonRN,
            ratio: totalNonRN > 0 ? `1:${Math.round(totalRN / totalNonRN)}` : '-',
        },
        capStatus: { suitable: capSuitable, improve: capImprove, shortage: capShortage },
        wardData: wardData.sort((a, b) => b.prod - a.prod),
    };
}

async function getOPDDashboard(date: string, wardId: string | null, deptType: string) {
    const conditions = [eq(opdDailyShifts.recordDate, date)];
    if (wardId) conditions.push(eq(opdDailyShifts.wardId, parseInt(wardId)));

    // Filter by dept_type (ER or LR) through the ward
    const shifts = await db.select({
        wardId: opdDailyShifts.wardId,
        wardName: nursingWards.name,
        wardDeptType: nursingWards.deptType,
        shift: opdDailyShifts.shift,
        rnCount: opdDailyShifts.rnCount,
        nonRnCount: opdDailyShifts.nonRnCount,
        patientTotal: opdDailyShifts.patientTotal,
        triage1: opdDailyShifts.triage1,
        triage2: opdDailyShifts.triage2,
        triage3: opdDailyShifts.triage3,
        triage4: opdDailyShifts.triage4,
        triage5: opdDailyShifts.triage5,
        ivpCount: opdDailyShifts.ivpCount,
        emsCount: opdDailyShifts.emsCount,
        lrCount: opdDailyShifts.lrCount,
        workloadScore: opdDailyShifts.workloadScore,
    })
    .from(opdDailyShifts)
    .leftJoin(nursingWards, eq(opdDailyShifts.wardId, nursingWards.id))
    .where(and(...conditions));

    // Filter by dept type if needed
    const filteredShifts = deptType === 'OPD'
        ? shifts
        : shifts.filter(s => s.wardDeptType === deptType);

    let totalRN = 0, totalNonRN = 0, totalPatients = 0, totalWorkload = 0;
    const wardData: { name: string; prod: number }[] = [];

    filteredShifts.forEach(s => {
        totalRN += s.rnCount ?? 0;
        totalNonRN += s.nonRnCount ?? 0;
        totalPatients += s.patientTotal ?? 0;
        totalWorkload += parseFloat(s.workloadScore ?? '0');
    });

    // Group by ward for chart
    const wardMap: { [key: string]: number } = {};
    filteredShifts.forEach(s => {
        const name = s.wardName ?? 'Unknown';
        wardMap[name] = (wardMap[name] ?? 0) + parseFloat(s.workloadScore ?? '0');
    });
    Object.entries(wardMap).forEach(([name, score]) => {
        wardData.push({ name, prod: parseFloat(score.toFixed(2)) });
    });

    return {
        date,
        deptType,
        productivity: 0,
        totalWorkforce: totalRN + totalNonRN,
        cmi: 0,
        patientVisit: totalPatients,
        shifts: {
            morning: { rn: 0, nonRn: 0 },
            afternoon: { rn: 0, nonRn: 0 },
            midnight: { rn: 0, nonRn: 0 },
        },
        workforce: { rn: totalRN, nonRn: totalNonRN },
        skillMix: {
            total: totalRN + totalNonRN,
            onDuty: totalRN + totalNonRN,
            ratio: totalNonRN > 0 ? `1:${Math.round(totalRN / totalNonRN)}` : '-',
        },
        capStatus: { suitable: 0, improve: 0, shortage: 0 },
        wardData: wardData.sort((a, b) => b.prod - a.prod),
        workloadScore: parseFloat(totalWorkload.toFixed(2)),
    };
}
