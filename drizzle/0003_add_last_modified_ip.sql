ALTER TABLE "ipd_daily_shifts" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "ipd_daily_shifts" ALTER COLUMN "updated_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "ipd_daily_summary" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "ipd_daily_summary" ALTER COLUMN "updated_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "nursing_wards" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "nursing_wards" ALTER COLUMN "updated_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "opd_daily_shifts" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "opd_daily_shifts" ALTER COLUMN "updated_at" SET DEFAULT now() AT TIME ZONE 'Asia/Bangkok';--> statement-breakpoint
ALTER TABLE "ipd_daily_shifts" ADD COLUMN "last_modified_ip" varchar(45);--> statement-breakpoint
ALTER TABLE "ipd_daily_summary" ADD COLUMN "last_modified_ip" varchar(45);--> statement-breakpoint
ALTER TABLE "nursing_wards" ADD COLUMN "last_modified_ip" varchar(45);--> statement-breakpoint
ALTER TABLE "opd_daily_shifts" ADD COLUMN "last_modified_ip" varchar(45);