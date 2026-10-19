import { sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';

/**
 * SQL expression ที่คืนเวลาไทย (Asia/Bangkok, UTC+7)
 * ใช้แทน new Date() ทุกที่ที่ต้องตั้ง created_at / updated_at
 * 
 * ทำงานฝั่ง PostgreSQL โดยตรง — ไม่พึ่ง timezone ของ Node.js
 */
export const nowBangkok = () => sql`now() AT TIME ZONE 'Asia/Bangkok'`;

/**
 * ดึง IP address ของ client จาก request headers
 * รองรับทั้ง reverse proxy (x-forwarded-for, x-real-ip) และ direct connection
 */
export function getClientIp(request: NextRequest): string {
    // ลำดับการเช็ค: x-forwarded-for → x-real-ip → fallback
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        // x-forwarded-for อาจมีหลาย IP คั่นด้วย comma — เอาตัวแรก (client จริง)
        return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp.trim();
    }

    return 'unknown';
}
