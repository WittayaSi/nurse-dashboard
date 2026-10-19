// ตั้ง timezone ของ Node.js process เป็นเวลาไทย (UTC+7)
// ต้องตั้งก่อน import อื่นๆ เพื่อให้ new Date() คืนเวลาไทย
process.env.TZ = 'Asia/Bangkok';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,                    // จำนวน connection สูงสุดใน pool
    idleTimeoutMillis: 30_000,  // ปิด connection ที่ idle เกิน 30 วินาที
    connectionTimeoutMillis: 5_000, // timeout ถ้ารอ connection นานเกิน 5 วินาที
});

// ตั้ง timezone ของ PostgreSQL session เป็นเวลาไทย
pool.on('connect', (client) => {
    client.query("SET timezone = 'Asia/Bangkok'");
});

export const db = drizzle(pool, { schema });
