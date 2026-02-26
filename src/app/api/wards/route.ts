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
                .where(eq(nursingWards.deptType, deptType));
        } else {
            result = await db.select().from(nursingWards);
        }

        return NextResponse.json(result);
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
