import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const statements = [
    // เพิ่ม column last_modified_ip ทุก table
    `ALTER TABLE nursing_wards ADD COLUMN IF NOT EXISTS last_modified_ip varchar(45)`,
    `ALTER TABLE ipd_daily_shifts ADD COLUMN IF NOT EXISTS last_modified_ip varchar(45)`,
    `ALTER TABLE ipd_daily_summary ADD COLUMN IF NOT EXISTS last_modified_ip varchar(45)`,
    `ALTER TABLE opd_daily_shifts ADD COLUMN IF NOT EXISTS last_modified_ip varchar(45)`,
    // เปลี่ยน default ของ created_at / updated_at เป็นเวลาไทย
    `ALTER TABLE nursing_wards ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
    `ALTER TABLE nursing_wards ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
    `ALTER TABLE ipd_daily_shifts ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
    `ALTER TABLE ipd_daily_shifts ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
    `ALTER TABLE ipd_daily_summary ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
    `ALTER TABLE ipd_daily_summary ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
    `ALTER TABLE opd_daily_shifts ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
    `ALTER TABLE opd_daily_shifts ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')`,
];

async function migrate() {
    const client = await pool.connect();
    try {
        for (const sql of statements) {
            console.log(`Running: ${sql}`);
            await client.query(sql);
            console.log('  ✓ Done');
        }
        console.log('\n✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
