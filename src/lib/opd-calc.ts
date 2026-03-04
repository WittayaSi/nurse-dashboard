/**
 * OPD Calculation Utilities
 * Shared Productivity formula used across OPD pages and dashboard.
 */

const SHIFT_HOURS = 7;

/**
 * Calculate OPD Expected Staff from workload
 * Formula: Workload / 7
 * @param workload - คะแนนภาระงานรวม (workloadScore)
 * @returns จำนวนบุคลากรที่ควรมี
 */
export function calcOPDExpectStaff(workload: number): number {
    if (workload <= 0) return 0;
    return parseFloat((workload / SHIFT_HOURS).toFixed(2));
}

/**
 * Calculate OPD Productivity
 * Formula: (NHPPD Expect × 100) / NHPPD Actual
 * @param workload - คะแนนภาระงานรวม (workloadScore)
 * @param actualStaff - จำนวนบุคลากรจริง (RN + Non-RN)
 * @param patients - จำนวนผู้ป่วยรวม
 * @returns Productivity % rounded to 2 decimal places
 */
export function calcOPDProductivity(workload: number, actualStaff: number, patients: number): number {
    const nhppdExpect = calcOPDNhppdExpect(workload, patients);
    const nhppdActual = calcOPDNhppdActual(actualStaff, patients);
    if (nhppdActual <= 0) return 0;
    return parseFloat(((nhppdExpect * 100) / nhppdActual).toFixed(2));
}

/**
 * Calculate NHPPD (Expect) - Nursing Hours Per Patient Day (ที่ควรมี)
 * Formula: Nursing Need / patients
 * @param workload - คะแนนภาระงานรวม (Nursing Need)
 * @param patients - จำนวนผู้ป่วยรวม
 * @returns NHPPD Expect (6 decimal places)
 */
export function calcOPDNhppdExpect(workload: number, patients: number): number {
    if (patients <= 0) return 0;
    return parseFloat((workload / patients).toFixed(6));
}

/**
 * Calculate NHPPD (Actual) - Nursing Hours Per Patient Day (จริง)
 * Formula: (ActualStaff × 7) / patients
 * @param actualStaff - จำนวนบุคลากรจริง
 * @param patients - จำนวนผู้ป่วยรวม
 * @returns NHPPD Actual (6 decimal places)
 */
export function calcOPDNhppdActual(actualStaff: number, patients: number): number {
    if (patients <= 0) return 0;
    return parseFloat(((actualStaff * SHIFT_HOURS) / patients).toFixed(6));
}
