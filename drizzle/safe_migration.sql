-- Safe migration: only creates tables if they don't exist
-- This will NOT affect any existing tables in the database

CREATE TABLE IF NOT EXISTS "nursing_wards" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar(20) NOT NULL,
    "name" varchar(100) NOT NULL,
    "dept_type" varchar(10) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "nursing_wards_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "ipd_daily_shifts" (
    "id" serial PRIMARY KEY NOT NULL,
    "ward_id" integer NOT NULL,
    "record_date" date NOT NULL,
    "shift" varchar(10) NOT NULL,
    "hn_count" integer DEFAULT 0,
    "rn_count" integer DEFAULT 0,
    "tn_count" integer DEFAULT 0,
    "na_count" integer DEFAULT 0,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "ipd_shift_unique" UNIQUE("ward_id","record_date","shift")
);

CREATE TABLE IF NOT EXISTS "ipd_daily_summary" (
    "id" serial PRIMARY KEY NOT NULL,
    "ward_id" integer NOT NULL,
    "record_date" date NOT NULL,
    "total_staff_day" integer DEFAULT 0,
    "patient_day" integer DEFAULT 0,
    "hppd" numeric(5, 2) DEFAULT '0',
    "discharge_count" integer DEFAULT 0,
    "new_admission" integer DEFAULT 0,
    "productivity" numeric(5, 2) DEFAULT '0',
    "cmi" numeric(5, 2) DEFAULT '0',
    "cap_status" varchar(20) DEFAULT 'suitable',
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "ipd_summary_unique" UNIQUE("ward_id","record_date")
);

CREATE TABLE IF NOT EXISTS "opd_daily_shifts" (
    "id" serial PRIMARY KEY NOT NULL,
    "ward_id" integer NOT NULL,
    "record_date" date NOT NULL,
    "shift" varchar(10) NOT NULL,
    "rn_count" integer DEFAULT 0,
    "non_rn_count" integer DEFAULT 0,
    "patient_total" integer DEFAULT 0,
    "triage_1" integer DEFAULT 0,
    "triage_2" integer DEFAULT 0,
    "triage_3" integer DEFAULT 0,
    "triage_4" integer DEFAULT 0,
    "triage_5" integer DEFAULT 0,
    "ivp_count" integer DEFAULT 0,
    "ems_count" integer DEFAULT 0,
    "lr_count" integer DEFAULT 0,
    "workload_score" numeric(8, 2) DEFAULT '0',
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "opd_shift_unique" UNIQUE("ward_id","record_date","shift")
);

-- Add foreign keys only if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ipd_daily_shifts_ward_id_nursing_wards_id_fk') THEN
        ALTER TABLE "ipd_daily_shifts" ADD CONSTRAINT "ipd_daily_shifts_ward_id_nursing_wards_id_fk"
            FOREIGN KEY ("ward_id") REFERENCES "nursing_wards"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ipd_daily_summary_ward_id_nursing_wards_id_fk') THEN
        ALTER TABLE "ipd_daily_summary" ADD CONSTRAINT "ipd_daily_summary_ward_id_nursing_wards_id_fk"
            FOREIGN KEY ("ward_id") REFERENCES "nursing_wards"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opd_daily_shifts_ward_id_nursing_wards_id_fk') THEN
        ALTER TABLE "opd_daily_shifts" ADD CONSTRAINT "opd_daily_shifts_ward_id_nursing_wards_id_fk"
            FOREIGN KEY ("ward_id") REFERENCES "nursing_wards"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;

-- Seed initial wards data
INSERT INTO "nursing_wards" ("code", "name", "dept_type") VALUES
    ('IPD-18', '18 อายุรกรรม', 'IPD'),
    ('IPD-17', '17 ผู้ป่วยหนัก', 'IPD'),
    ('IPD-10', '10 ศัลยกรรม', 'IPD'),
    ('IPD-06', '6 EENT', 'IPD'),
    ('IPD-04', '4 ออร์โธปิดิกส์', 'IPD'),
    ('IPD-03', '3 กุมาร', 'IPD'),
    ('IPD-02', '2 สูติ-นรีเวช', 'IPD'),
    ('IPD-01', '1 ฉุกเฉิน ICU', 'IPD'),
    ('ER-01', 'ห้องฉุกเฉิน (ER)', 'ER'),
    ('LR-01', 'ห้องคลอด (LR)', 'LR')
ON CONFLICT ("code") DO NOTHING;
