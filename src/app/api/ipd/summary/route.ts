import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ipdDailySummary, nursingWards } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// GET - List IPD daily summary (filter by date, ward_id)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const wardId = searchParams.get('wardId');

        const conditions = [];
        if (date) conditions.push(eq(ipdDailySummary.recordDate, date));
        if (wardId) conditions.push(eq(ipdDailySummary.wardId, parseInt(wardId)));

        const result = await db.select({
            id: ipdDailySummary.id,
            wardId: ipdDailySummary.wardId,
            wardName: nursingWards.name,
            wardCode: nursingWards.code,
            recordDate: ipdDailySummary.recordDate,
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
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(ipdDailySummary.wardId);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching IPD summary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create or update IPD daily summary
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rows = Array.isArray(body) ? body : [body];

        for (const row of rows) {
            if (!row.wardId || !row.recordDate) {
                return NextResponse.json(
                    { error: 'wardId and recordDate are required' },
                    { status: 400 }
                );
            }
        }

        const values = rows.map(row => ({
            wardId: row.wardId,
            recordDate: row.recordDate,
            totalStaffDay: row.totalStaffDay ?? 0,
            patientDay: row.patientDay ?? 0,
            hppd: row.hppd?.toString() ?? '0',
            dischargeCount: row.dischargeCount ?? 0,
            newAdmission: row.newAdmission ?? 0,
            productivity: row.productivity?.toString() ?? '0',
            cmi: row.cmi?.toString() ?? '0',
            capStatus: row.capStatus ?? 'suitable',
        }));

        const result = await db.insert(ipdDailySummary)
            .values(values)
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

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error('Error saving IPD summary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
