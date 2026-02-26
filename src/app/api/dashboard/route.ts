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
    const shiftConditions = [
        eq(ipdDailyShifts.recordDate, date),
        eq(nursingWards.deptType, 'IPD')
    ];
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
    .innerJoin(nursingWards, eq(ipdDailyShifts.wardId, nursingWards.id))
    .where(and(...shiftConditions));

    // Get summary data
    const summaryConditions = [
        eq(ipdDailySummary.recordDate, date),
        eq(nursingWards.deptType, 'IPD')
    ];
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
    .innerJoin(nursingWards, eq(ipdDailySummary.wardId, nursingWards.id))
    .where(and(...summaryConditions));

    // Aggregate shifts
    const shiftTotals = { morning: { hn: 0, rn: 0, tn: 0, na: 0 }, afternoon: { hn: 0, rn: 0, tn: 0, na: 0 }, night: { hn: 0, rn: 0, tn: 0, na: 0 } };
    let totalHN = 0, totalRnOnly = 0, totalTN = 0, totalNA = 0;

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
        totalHN += hn;
        totalRnOnly += rn;
        totalTN += tn;
        totalNA += na;
    });

    const totalRN = totalHN + totalRnOnly;
    const totalNonRN = totalTN + totalNA;

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
            morning: { rn: shiftTotals.morning.hn + shiftTotals.morning.rn, nonRn: shiftTotals.morning.tn + shiftTotals.morning.na, hn: shiftTotals.morning.hn, rnOnly: shiftTotals.morning.rn, tn: shiftTotals.morning.tn, na: shiftTotals.morning.na },
            afternoon: { rn: shiftTotals.afternoon.hn + shiftTotals.afternoon.rn, nonRn: shiftTotals.afternoon.tn + shiftTotals.afternoon.na, hn: shiftTotals.afternoon.hn, rnOnly: shiftTotals.afternoon.rn, tn: shiftTotals.afternoon.tn, na: shiftTotals.afternoon.na },
            midnight: { rn: shiftTotals.night.hn + shiftTotals.night.rn, nonRn: shiftTotals.night.tn + shiftTotals.night.na, hn: shiftTotals.night.hn, rnOnly: shiftTotals.night.rn, tn: shiftTotals.night.tn, na: shiftTotals.night.na },
        },
        workforce: { rn: totalRN, nonRn: totalNonRN, hn: totalHN, rnOnly: totalRnOnly, tn: totalTN, na: totalNA },
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
    const shiftStaff: Record<string, { rn: number; nonRn: number; workload: number }> = {
        morning: { rn: 0, nonRn: 0, workload: 0 },
        afternoon: { rn: 0, nonRn: 0, workload: 0 },
        night: { rn: 0, nonRn: 0, workload: 0 },
        midnight: { rn: 0, nonRn: 0, workload: 0 },
    };

    filteredShifts.forEach(s => {
        totalRN += s.rnCount ?? 0;
        totalNonRN += s.nonRnCount ?? 0;
        totalPatients += s.patientTotal ?? 0;
        const wl = parseFloat(s.workloadScore ?? '0');
        totalWorkload += wl;

        // Per-shift staff
        const shiftKey = s.shift === 'night' ? 'midnight' : s.shift;
        if (shiftStaff[shiftKey] || shiftStaff[s.shift]) {
            const key = shiftStaff[shiftKey] ? shiftKey : s.shift;
            shiftStaff[key].rn += s.rnCount ?? 0;
            shiftStaff[key].nonRn += s.nonRnCount ?? 0;
            shiftStaff[key].workload += wl;
        }
    });

    // Group by ward for chart
    const wardMap: { [key: string]: { workload: number; staff: number } } = {};
    filteredShifts.forEach(s => {
        const name = s.wardName ?? 'Unknown';
        if (!wardMap[name]) {
            wardMap[name] = { workload: 0, staff: 0 };
        }
        wardMap[name].workload += parseFloat(s.workloadScore ?? '0');
        wardMap[name].staff += (s.rnCount ?? 0) + (s.nonRnCount ?? 0);
    });
    
    Object.entries(wardMap).forEach(([name, data]) => {
        if (data.staff > 0) {
            const expect = data.workload / 7;
            const prod = (expect / data.staff) * 100;
            wardData.push({ name, prod: parseFloat(prod.toFixed(2)) });
        } else {
            wardData.push({ name, prod: 0 });
        }
    });

    // Calculate OPD productivity using LR Standard Formula:
    // 1. Nursing Need (Workload) = totalWorkload (Sum of count * multiplier)
    // 2. Expect Staff = Workload / 7 (hours per shift)
    // 3. Actual Staff = totalStaff (RN + Non-RN)
    // 4. Productivity = (Expect / Actual) * 100
    const totalStaff = totalRN + totalNonRN;
    const expectStaff = totalWorkload / 7;
    const opdProductivity = totalStaff > 0
        ? parseFloat(((expectStaff / totalStaff) * 100).toFixed(2))
        : 0;

    // Helper to enrich shift with productivity
    const enrichShift = (s: { rn: number; nonRn: number; workload: number }) => {
        const actual = s.rn + s.nonRn;
        const expect = s.workload / 7;
        const prod = actual > 0 ? (expect / actual) * 100 : 0;
        return { ...s, actual, expect, productivity: parseFloat(prod.toFixed(2)) };
    };

    return {
        date,
        deptType,
        productivity: opdProductivity,
        totalWorkforce: totalStaff,
        cmi: 0,
        patientVisit: totalPatients,
        shifts: {
            morning: enrichShift(shiftStaff.morning),
            afternoon: enrichShift(shiftStaff.afternoon),
            midnight: enrichShift(shiftStaff.midnight),
        },
        workforce: { rn: totalRN, nonRn: totalNonRN },
        skillMix: {
            total: totalStaff,
            onDuty: totalStaff,
            ratio: totalNonRN > 0 ? `1:${Math.round(totalRN / totalNonRN)}` : '-',
        },
        capStatus: { suitable: 0, improve: 0, shortage: 0 },
        wardData: wardData.sort((a, b) => b.prod - a.prod),
        workloadScore: parseFloat(totalWorkload.toFixed(2)),
    };
}
