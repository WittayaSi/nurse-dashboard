import { NextResponse } from 'next/server';
import { db } from '@/db';
import { nursingWards, factVisits } from '@/db/schema';
import { eq, sql, inArray, and, lte, gt, isNull, or } from 'drizzle-orm';
import { Pool } from 'pg';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { wardId, date } = body;

        if (!wardId || !date) {
            return NextResponse.json({ error: 'Missing wardId or date' }, { status: 400 });
        }

        // Convert YYYY-MM-DD to YYYYMMDD integer for fact_visits
        const dateObj = new Date(date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = parseInt(`${yyyy}${mm}${dd}`, 10);

        // Fetch mapped hisWardKeys from nursing_wards
        const ward = await db.query.nursingWards.findFirst({
            where: eq(nursingWards.id, parseInt(wardId)),
            columns: { hisWardKeys: true }
        });

        if (!ward || !ward.hisWardKeys || ward.hisWardKeys.length === 0) {
            return NextResponse.json({ 
                patientDay: 0, newAdmission: 0, dischargeCount: 0 
            });
        }

        const hisKeys = ward.hisWardKeys;

        // 1. Patient Day: visitors who were admitted on or before target date, and have not yet been discharged (or discharged after target date)
        const patientDayResult = await db.select({ count: sql<number>`cast(count(*) as int)` })
            .from(factVisits)
            .where(
                and(
                    inArray(factVisits.wardKey, hisKeys),
                    eq(factVisits.isCancelled, 0),
                    lte(factVisits.visitDateKey, dateKey),
                    or(
                        isNull(factVisits.dischargeDateKey),
                        gt(factVisits.dischargeDateKey, dateKey)
                    )
                )
            );

        // 2. New Admissions: admitted exactly on the target date
        const admissionResult = await db.select({ count: sql<number>`cast(count(*) as int)` })
            .from(factVisits)
            .where(
                and(
                    inArray(factVisits.wardKey, hisKeys),
                    eq(factVisits.isCancelled, 0),
                    eq(factVisits.isAdmit, 1),
                    eq(factVisits.visitDateKey, dateKey)
                )
            );

        // 3. Discharges: discharged exactly on the target date
        const dischargeResult = await db.select({ count: sql<number>`cast(count(*) as int)` })
            .from(factVisits)
            .where(
                and(
                    inArray(factVisits.wardKey, hisKeys),
                    eq(factVisits.isCancelled, 0),
                    eq(factVisits.isDischarge, 1),
                    eq(factVisits.dischargeDateKey, dateKey)
                )
            );

        // 4. Get total bed count from dim_ward
        let totalBeds = 0;
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        try {
            const bedResult = await pool.query(
                `SELECT COALESCE(SUM(bed_count), 0) as total_beds FROM dim_ward WHERE ward_key = ANY($1::int[])`,
                [hisKeys]
            );
            totalBeds = parseInt(bedResult.rows[0].total_beds, 10);
        } catch (err) {
            console.error("Error fetching bed count:", err);
        } finally {
            pool.end();
        }

        return NextResponse.json({
            patientDay: patientDayResult[0].count || 0,
            newAdmission: admissionResult[0].count || 0,
            dischargeCount: dischargeResult[0].count || 0,
            mappedHisKeys: hisKeys,
            totalBeds
        });

    } catch (error: any) {
        console.error('HIS API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
