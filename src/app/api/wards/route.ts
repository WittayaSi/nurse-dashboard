import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { nursingWards } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET - List all wards (optional filter by dept_type)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const deptType = searchParams.get('deptType');

        let result;
        if (deptType) {
            result = await db.select().from(nursingWards)
                .where(eq(nursingWards.deptType, deptType))
                .orderBy(nursingWards.code);
        } else {
            result = await db.select().from(nursingWards)
                .orderBy(nursingWards.code);
        }

        // Fetch all dim_wards to map bedCount
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        try {
            const dimWardsRes = await pool.query("SELECT ward_key, bed_count FROM dim_ward");
            const dimWardsMap = new Map();
            dimWardsRes.rows.forEach((dw: any) => {
                dimWardsMap.set(dw.ward_key, parseInt(dw.bed_count || '0', 10));
            });

            const enrichedResult = result.map(ward => {
                let bedCount = 0;
                if (ward.hisWardKeys && Array.isArray(ward.hisWardKeys)) {
                    bedCount = ward.hisWardKeys.reduce((sum, key) => sum + (dimWardsMap.get(key) || 0), 0);
                }
                return { ...ward, bedCount };
            });

            return NextResponse.json(enrichedResult);
        } finally {
            pool.end();
        }
    } catch (error: any) {
        console.error('Error fetching wards:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create a new ward
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { code, name, deptType } = body;

        if (!code || !name || !deptType) {
            return NextResponse.json({ error: 'code, name, deptType are required' }, { status: 400 });
        }

        const result = await db.insert(nursingWards).values({
            code,
            name,
            deptType,
        }).returning();

        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error('Error creating ward:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
