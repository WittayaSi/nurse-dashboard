import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { opdDailyShifts, nursingWards } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// GET - List OPD shifts (filter by date, ward_id)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const wardId = searchParams.get('wardId');

        const conditions = [];
        if (date) conditions.push(eq(opdDailyShifts.recordDate, date));
        if (wardId) conditions.push(eq(opdDailyShifts.wardId, parseInt(wardId)));

        const result = await db.select({
            id: opdDailyShifts.id,
            wardId: opdDailyShifts.wardId,
            wardName: nursingWards.name,
            wardCode: nursingWards.code,
            recordDate: opdDailyShifts.recordDate,
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
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(opdDailyShifts.wardId, opdDailyShifts.shift);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching OPD shifts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create or bulk create OPD shifts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rows = Array.isArray(body) ? body : [body];

        for (const row of rows) {
            if (!row.wardId || !row.recordDate || !row.shift) {
                return NextResponse.json(
                    { error: 'wardId, recordDate, shift are required' },
                    { status: 400 }
                );
            }
        }

        // Calculate workload score for each row
        const values = rows.map(row => {
            const t1 = row.triage1 ?? 0;
            const t2 = row.triage2 ?? 0;
            const t3 = row.triage3 ?? 0;
            const t4 = row.triage4 ?? 0;
            const t5 = row.triage5 ?? 0;
            const ivp = row.ivpCount ?? 0;
            const ems = row.emsCount ?? 0;
            const lr = row.lrCount ?? 0;

            const workload = (t1 * 3.2) + (t2 * 2.5) + (t3 * 1.0)
                + (t4 * 0.5) + (t5 * 0.25)
                + (ivp * 2.0) + (ems * 1.5) + (lr * 3.5);

            return {
                wardId: row.wardId,
                recordDate: row.recordDate,
                shift: row.shift,
                rnCount: row.rnCount ?? 0,
                nonRnCount: row.nonRnCount ?? 0,
                patientTotal: row.patientTotal ?? 0,
                triage1: t1,
                triage2: t2,
                triage3: t3,
                triage4: t4,
                triage5: t5,
                ivpCount: ivp,
                emsCount: ems,
                lrCount: lr,
                workloadScore: workload.toFixed(2),
            };
        });

        const result = await db.insert(opdDailyShifts)
            .values(values)
            .onConflictDoUpdate({
                target: [opdDailyShifts.wardId, opdDailyShifts.recordDate, opdDailyShifts.shift],
                set: {
                    rnCount: sql`excluded.rn_count`,
                    nonRnCount: sql`excluded.non_rn_count`,
                    patientTotal: sql`excluded.patient_total`,
                    triage1: sql`excluded.triage_1`,
                    triage2: sql`excluded.triage_2`,
                    triage3: sql`excluded.triage_3`,
                    triage4: sql`excluded.triage_4`,
                    triage5: sql`excluded.triage_5`,
                    ivpCount: sql`excluded.ivp_count`,
                    emsCount: sql`excluded.ems_count`,
                    lrCount: sql`excluded.lr_count`,
                    workloadScore: sql`excluded.workload_score`,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error('Error saving OPD shifts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
