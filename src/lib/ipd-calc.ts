/**
 * IPD Calculation Utilities
 * Shared HPPD and Productivity formulas used across input page and dashboard.
 */

const SHIFT_HOURS = 7;

/**
 * Calculate HPPD (Hours Per Patient Day)
 * Formula: (totalStaff × 7) / patientDay
 * @param totalStaff - จำนวนบุคลากรทั้งวัน (ทุกเวรรวมกัน)
 * @param patientDay - จำนวนผู้ป่วย
 * @returns HPPD rounded to 2 decimal places
 */
export function calcIPDHppd(totalStaff: number, patientDay: number): number {
    if (patientDay <= 0) return 0;
    return parseFloat(((totalStaff * SHIFT_HOURS) / patientDay).toFixed(2));
}

/**
 * Calculate Productivity
 * Formula: ((PatientDay × HPPD) / (Staff × 7)) × 100
 * @param totalStaff - จำนวนบุคลากรทั้งวัน (ทุกเวรรวมกัน)
 * @param patientDay - จำนวนผู้ป่วย
 * @param hppd - ค่า HPPD ที่คำนวณได้จาก calcIPDHppd()
 * @returns Productivity % rounded to 2 decimal places
 */
export function calcIPDProductivity(totalStaff: number, patientDay: number, hppd: number): number {
    if (totalStaff <= 0) return 0;
    return parseFloat(((patientDay * hppd) / (totalStaff * SHIFT_HOURS) * 100).toFixed(2));
}
