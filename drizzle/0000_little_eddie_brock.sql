CREATE TABLE "ipd_daily_shifts" (
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
--> statement-breakpoint
CREATE TABLE "ipd_daily_summary" (
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
--> statement-breakpoint
CREATE TABLE "nursing_wards" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"dept_type" varchar(10) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "nursing_wards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "opd_daily_shifts" (
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
--> statement-breakpoint
ALTER TABLE "ipd_daily_shifts" ADD CONSTRAINT "ipd_daily_shifts_ward_id_nursing_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."nursing_wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipd_daily_summary" ADD CONSTRAINT "ipd_daily_summary_ward_id_nursing_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."nursing_wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opd_daily_shifts" ADD CONSTRAINT "opd_daily_shifts_ward_id_nursing_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."nursing_wards"("id") ON DELETE no action ON UPDATE no action;