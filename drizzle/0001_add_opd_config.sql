-- Add JSONB columns for per-ward OPD field configuration
-- nursing_wards: stores field groups + multipliers config per ward
ALTER TABLE nursing_wards ADD COLUMN IF NOT EXISTS opd_fields_config JSONB;

-- opd_daily_shifts: stores dynamic field data per shift
ALTER TABLE opd_daily_shifts ADD COLUMN IF NOT EXISTS category_data JSONB;
