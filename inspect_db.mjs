import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load .env
const envFile = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
const dbUrlMatch = envFile.match(/DATABASE_URL=(.*)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1].trim() : '';

const pool = new Pool({ connectionString: dbUrl });

async function inspect() {
    try {
        console.log('--- dim_ward columns ---');
        const cols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'dim_ward';
        `);
        console.table(cols.rows);

        console.log('\n--- dim_ward data ---');
        const dimData = await pool.query(`SELECT * FROM dim_ward LIMIT 50;`);
        console.table(dimData.rows);

        console.log('\n--- nursing_wards data ---');
        const nsData = await pool.query(`SELECT id, code, name, dept_type FROM nursing_wards WHERE dept_type = 'IPD';`);
        console.table(nsData.rows);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

inspect();
