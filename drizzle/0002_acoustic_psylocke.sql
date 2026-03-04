CREATE TABLE "fact_visits" (
	"visit_sk" integer PRIMARY KEY NOT NULL,
	"source_visit_id" varchar(50),
	"source_admission_id" varchar(50),
	"visit_date_key" integer,
	"discharge_date_key" integer,
	"patient_sk" integer,
	"department_key" integer,
	"ward_key" integer,
	"attending_doctor_key" integer,
	"admission_doctor_key" integer,
	"owner_doctor_key" integer,
	"visit_type" varchar(20),
	"length_of_stay" numeric,
	"is_admit" integer DEFAULT 0,
	"is_discharge" integer DEFAULT 0,
	"visit_count" integer DEFAULT 1,
	"is_cancelled" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "ipd_daily_shifts" RENAME COLUMN "tn_count" TO "pn_count";--> statement-breakpoint
ALTER TABLE "nursing_wards" ADD COLUMN "his_ward_keys" jsonb;