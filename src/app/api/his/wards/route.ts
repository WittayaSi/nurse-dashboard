import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const result = await pool.query(
            "SELECT ward_key, source_ward_id, ward_name, bed_count FROM dim_ward WHERE is_visible = true ORDER BY source_ward_id"
        );
        return NextResponse.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching dim_ward:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        pool.end();
    }
}
