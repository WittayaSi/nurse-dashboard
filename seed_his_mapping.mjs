import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load .env
const envFile = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
const dbUrlMatch = envFile.match(/DATABASE_URL=(.*)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1].trim() : '';

const pool = new Pool({ connectionString: dbUrl });

const wardMappings = {
    'IPD-01': [4], // ICU
    'IPD-02': [5], // ผู้ใหญ่
    'IPD-03': [6], // เด็ก
    'IPD-04': [3, 7], // มารดาและทารก -> หลังคลอด, Nursery.
    'IPD-05': [8], // พิเศษ
};

async function seed() {
    try {
        await pool.query('ALTER TABLE nursing_wards ADD COLUMN IF NOT EXISTS his_ward_keys jsonb;');
        console.log('Added his_ward_keys column.');

        await pool.query('BEGIN');
        
        for (const [code, hisKeys] of Object.entries(wardMappings)) {
            await pool.query(
                `UPDATE nursing_wards SET his_ward_keys = $1 WHERE code = $2`,
                [JSON.stringify(hisKeys), code]
            );
            console.log(`Updated ${code} with his_ward_keys: [${hisKeys.join(', ')}]`);
        }

        await pool.query('COMMIT');
        console.log('Seeding completed successfully!');
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Seeding failed:', err);
    } finally {
        pool.end();
    }
}

seed();
