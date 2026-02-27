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

            // New flexible data
            categoryData: opdDailyShifts.categoryData,
            workloadScore: opdDailyShifts.workloadScore,
            updatedAt: opdDailyShifts.updatedAt,
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

        // Load ward config for workload calculation
        const wardIds = [...new Set(rows.map((r: any) => r.wardId))];
        const wardConfigs: Record<number, any> = {};
        for (const wid of wardIds) {
            const ward = await db.select({ opdFieldsConfig: nursingWards.opdFieldsConfig })
                .from(nursingWards)
                .where(eq(nursingWards.id, wid as number));
            if (ward.length > 0) wardConfigs[wid as number] = ward[0].opdFieldsConfig;
        }

        // Calculate workload score for each row
        const values = rows.map(row => {
            const categoryData = row.categoryData ?? {};
            const wardConfig = wardConfigs[row.wardId];

            // Calculate workload from ward config + categoryData
            let workload = 0;
            if (wardConfig && wardConfig.groups) {
                for (const group of wardConfig.groups) {
                    for (const field of group.fields) {
                        workload += (categoryData[field.key] ?? 0) * (field.multiplier ?? 1);
                    }
                }
            } else {
                // Fallback to legacy calculation if no config
                const t1 = row.triage1 ?? 0;
                const t2 = row.triage2 ?? 0;
                const t3 = row.triage3 ?? 0;
                const t4 = row.triage4 ?? 0;
                const t5 = row.triage5 ?? 0;
                const ivp = row.ivpCount ?? 0;
                const ems = row.emsCount ?? 0;
                const lr = row.lrCount ?? 0;
                workload = (t1 * 3.2) + (t2 * 2.5) + (t3 * 1.0)
                    + (t4 * 0.5) + (t5 * 0.25)
                    + (ivp * 2.0) + (ems * 1.5) + (lr * 3.5);
            }

            return {
                wardId: row.wardId,
                recordDate: row.recordDate,
                shift: row.shift,
                rnCount: row.rnCount ?? 0,
                nonRnCount: row.nonRnCount ?? 0,
                patientTotal: row.patientTotal ?? 0,

                // New flexible data
                categoryData: Object.keys(categoryData).length > 0 ? categoryData : null,
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

                    categoryData: sql`excluded.category_data`,
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
