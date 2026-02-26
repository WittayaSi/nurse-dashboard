import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ipdDailyShifts, nursingWards } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// GET - List IPD shifts (filter by date, ward_id)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const wardId = searchParams.get('wardId');

        const conditions = [];
        if (date) conditions.push(eq(ipdDailyShifts.recordDate, date));
        if (wardId) conditions.push(eq(ipdDailyShifts.wardId, parseInt(wardId)));

        const result = await db.select({
            id: ipdDailyShifts.id,
            wardId: ipdDailyShifts.wardId,
            wardName: nursingWards.name,
            wardCode: nursingWards.code,
            recordDate: ipdDailyShifts.recordDate,
            shift: ipdDailyShifts.shift,
            hnCount: ipdDailyShifts.hnCount,
            rnCount: ipdDailyShifts.rnCount,
            tnCount: ipdDailyShifts.tnCount,
            naCount: ipdDailyShifts.naCount,
        })
        .from(ipdDailyShifts)
        .leftJoin(nursingWards, eq(ipdDailyShifts.wardId, nursingWards.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(ipdDailyShifts.wardId, ipdDailyShifts.shift);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching IPD shifts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create or bulk create IPD shifts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Support both single object and array
        const rows = Array.isArray(body) ? body : [body];

        for (const row of rows) {
            if (!row.wardId || !row.recordDate || !row.shift) {
                return NextResponse.json(
                    { error: 'wardId, recordDate, shift are required for each row' },
                    { status: 400 }
                );
            }
        }

        const values = rows.map(row => ({
            wardId: row.wardId,
            recordDate: row.recordDate,
            shift: row.shift,
            hnCount: row.hnCount ?? 0,
            rnCount: row.rnCount ?? 0,
            tnCount: row.tnCount ?? 0,
            naCount: row.naCount ?? 0,
        }));

        const result = await db.insert(ipdDailyShifts)
            .values(values)
            .onConflictDoUpdate({
                target: [ipdDailyShifts.wardId, ipdDailyShifts.recordDate, ipdDailyShifts.shift],
                set: {
                    hnCount: sql`excluded.hn_count`,
                    rnCount: sql`excluded.rn_count`,
                    tnCount: sql`excluded.tn_count`,
                    naCount: sql`excluded.na_count`,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error('Error saving IPD shifts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
