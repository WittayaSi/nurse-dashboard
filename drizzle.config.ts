import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    tablesFilter: ['nursing_wards', 'ipd_daily_shifts', 'ipd_daily_summary', 'opd_daily_shifts'],
});
