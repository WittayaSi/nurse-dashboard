import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ipdDailyShifts, ipdDailySummary } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { shifts, summary } = body;

        if (!shifts || !Array.isArray(shifts) || !summary) {
             return NextResponse.json(
                { error: 'Invalid payload structure. Expected shifts array and summary object.' },
                { status: 400 }
            );
        }

        // Validate shifts
        for (const row of shifts) {
            if (!row.wardId || !row.recordDate || !row.shift) {
                return NextResponse.json(
                    { error: 'wardId, recordDate, shift are required for each shift row' },
                    { status: 400 }
                );
            }
        }

        // Validate summary
        if (!summary.wardId || !summary.recordDate) {
            return NextResponse.json(
                { error: 'wardId and recordDate are required for summary' },
                { status: 400 }
            );
        }

        const shiftValues = shifts.map(row => ({
            wardId: row.wardId,
            recordDate: row.recordDate,
            shift: row.shift,
            hnCount: row.hnCount ?? 0,
            rnCount: row.rnCount ?? 0,
            tnCount: row.tnCount ?? 0,
            naCount: row.naCount ?? 0,
        }));

        const summaryValue = {
            wardId: summary.wardId,
            recordDate: summary.recordDate,
            totalStaffDay: summary.totalStaffDay ?? 0,
            patientDay: summary.patientDay ?? 0,
            hppd: summary.hppd?.toString() ?? '0',
            dischargeCount: summary.dischargeCount ?? 0,
            newAdmission: summary.newAdmission ?? 0,
            productivity: summary.productivity?.toString() ?? '0',
            cmi: summary.cmi?.toString() ?? '0',
            capStatus: summary.capStatus ?? 'suitable',
        };

        // Use transaction to ensure both shifts and summary are saved successfully or rollback entirely
        const result = await db.transaction(async (tx) => {
            // 1. Save Shifts
            await tx.insert(ipdDailyShifts)
                .values(shiftValues)
                .onConflictDoUpdate({
                    target: [ipdDailyShifts.wardId, ipdDailyShifts.recordDate, ipdDailyShifts.shift],
                    set: {
                        hnCount: sql`excluded.hn_count`,
                        rnCount: sql`excluded.rn_count`,
                        tnCount: sql`excluded.tn_count`,
                        naCount: sql`excluded.na_count`,
                        updatedAt: new Date(),
                    },
                });

            // 2. Save Summary
            const savedSummary = await tx.insert(ipdDailySummary)
                .values(summaryValue)
                .onConflictDoUpdate({
                    target: [ipdDailySummary.wardId, ipdDailySummary.recordDate],
                    set: {
                        totalStaffDay: sql`excluded.total_staff_day`,
                        patientDay: sql`excluded.patient_day`,
                        hppd: sql`excluded.hppd`,
                        dischargeCount: sql`excluded.discharge_count`,
                        newAdmission: sql`excluded.new_admission`,
                        productivity: sql`excluded.productivity`,
                        cmi: sql`excluded.cmi`,
                        capStatus: sql`excluded.cap_status`,
                        updatedAt: new Date(),
                    },
                })
                .returning();

            return savedSummary;
        });

        return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error: any) {
        console.error('Error saving IPD all data in transaction:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
