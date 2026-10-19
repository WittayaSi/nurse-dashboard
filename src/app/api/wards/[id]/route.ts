import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { nursingWards } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nowBangkok, getClientIp } from '@/lib/timezone';

// GET - Get a single ward by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const wardId = parseInt(id);
        if (isNaN(wardId)) return NextResponse.json({ error: 'Invalid ward ID' }, { status: 400 });
        const result = await db.select().from(nursingWards)
            .where(eq(nursingWards.id, wardId));

        if (result.length === 0) {
            return NextResponse.json({ error: 'Ward not found' }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error('Error fetching ward:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT - Update a ward
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { code, name, deptType, opdFieldsConfig, hisWardKeys } = body;

        const wardId = parseInt(id);
        if (isNaN(wardId)) return NextResponse.json({ error: 'Invalid ward ID' }, { status: 400 });

        const result = await db.update(nursingWards)
            .set({
                ...(code && { code }),
                ...(name && { name }),
                ...(deptType && { deptType }),
                ...(opdFieldsConfig !== undefined && { opdFieldsConfig }),
                ...(hisWardKeys !== undefined && { hisWardKeys }),
                updatedAt: nowBangkok(),
                lastModifiedIp: getClientIp(request),
            })
            .where(eq(nursingWards.id, wardId))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Ward not found' }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error('Error updating ward:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE - Delete a ward
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const wardId = parseInt(id);
        if (isNaN(wardId)) return NextResponse.json({ error: 'Invalid ward ID' }, { status: 400 });

        const result = await db.delete(nursingWards)
            .where(eq(nursingWards.id, wardId))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Ward not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting ward:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

