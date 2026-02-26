import {
    pgTable,
    serial,
    varchar,
    integer,
    numeric,
    boolean,
    date,
    timestamp,
    unique,
    jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// nursing_wards - หอผู้ป่วย / หน่วยงาน
// ==========================================
export const nursingWards = pgTable('nursing_wards', {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 20 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    deptType: varchar('dept_type', { length: 10 }).notNull(), // IPD, OPD, ER, LR
    isActive: boolean('is_active').default(true),
    // Per-ward OPD workload field config (groups of fields with multipliers)
    opdFieldsConfig: jsonb('opd_fields_config'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// ipd_daily_shifts - IPD กำลังคนรายเวร
// ==========================================
export const ipdDailyShifts = pgTable('ipd_daily_shifts', {
    id: serial('id').primaryKey(),
    wardId: integer('ward_id').notNull().references(() => nursingWards.id),
    recordDate: date('record_date').notNull(),
    shift: varchar('shift', { length: 10 }).notNull(), // morning, afternoon, night
    hnCount: integer('hn_count').default(0),
    rnCount: integer('rn_count').default(0),
    tnCount: integer('tn_count').default(0),
    naCount: integer('na_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    unique('ipd_shift_unique').on(table.wardId, table.recordDate, table.shift),
]);

// ==========================================
// ipd_daily_summary - IPD สรุปรายวัน
// ==========================================
export const ipdDailySummary = pgTable('ipd_daily_summary', {
    id: serial('id').primaryKey(),
    wardId: integer('ward_id').notNull().references(() => nursingWards.id),
    recordDate: date('record_date').notNull(),
    totalStaffDay: integer('total_staff_day').default(0),
    patientDay: integer('patient_day').default(0),
    hppd: numeric('hppd', { precision: 5, scale: 2 }).default('0'),
    dischargeCount: integer('discharge_count').default(0),
    newAdmission: integer('new_admission').default(0),
    productivity: numeric('productivity', { precision: 5, scale: 2 }).default('0'),
    cmi: numeric('cmi', { precision: 5, scale: 2 }).default('0'),
    capStatus: varchar('cap_status', { length: 20 }).default('suitable'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    unique('ipd_summary_unique').on(table.wardId, table.recordDate),
]);

// ==========================================
// opd_daily_shifts - OPD (ER/LR) รายเวร
// ==========================================
export const opdDailyShifts = pgTable('opd_daily_shifts', {
    id: serial('id').primaryKey(),
    wardId: integer('ward_id').notNull().references(() => nursingWards.id),
    recordDate: date('record_date').notNull(),
    shift: varchar('shift', { length: 10 }).notNull(), // morning, afternoon, night

    // กำลังคน
    rnCount: integer('rn_count').default(0),
    nonRnCount: integer('non_rn_count').default(0),
    patientTotal: integer('patient_total').default(0),

    // ผู้ป่วยตาม Triage Level
    triage1: integer('triage_1').default(0),   // Level 1 (x3.2) ฉุกเฉินวิกฤต
    triage2: integer('triage_2').default(0),   // Level 2 (x2.5) ฉุกเฉินเร่งด่วน
    triage3: integer('triage_3').default(0),   // Level 3 (x1.0) เร่งด่วน
    triage4: integer('triage_4').default(0),   // Level 4 (x0.5) ไม่รุนแรง
    triage5: integer('triage_5').default(0),   // Level 5 (x0.25) ทั่วไป

    // หัตถการเพิ่มเติม
    ivpCount: integer('ivp_count').default(0),   // IVP (x2.0)
    emsCount: integer('ems_count').default(0),   // EMS (x1.5)
    lrCount: integer('lr_count').default(0),     // จินสูตร/LR (x3.5)

    // Dynamic category data (JSONB) — stores per-ward flexible fields
    categoryData: jsonb('category_data'),

    // Workload Score (คำนวณ)
    workloadScore: numeric('workload_score', { precision: 8, scale: 2 }).default('0'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    unique('opd_shift_unique').on(table.wardId, table.recordDate, table.shift),
]);

// ==========================================
// Relations
// ==========================================
export const nursingWardsRelations = relations(nursingWards, ({ many }) => ({
    ipdShifts: many(ipdDailyShifts),
    ipdSummary: many(ipdDailySummary),
    opdShifts: many(opdDailyShifts),
}));

export const ipdDailyShiftsRelations = relations(ipdDailyShifts, ({ one }) => ({
    ward: one(nursingWards, {
        fields: [ipdDailyShifts.wardId],
        references: [nursingWards.id],
    }),
}));

export const ipdDailySummaryRelations = relations(ipdDailySummary, ({ one }) => ({
    ward: one(nursingWards, {
        fields: [ipdDailySummary.wardId],
        references: [nursingWards.id],
    }),
}));

export const opdDailyShiftsRelations = relations(opdDailyShifts, ({ one }) => ({
    ward: one(nursingWards, {
        fields: [opdDailyShifts.wardId],
        references: [nursingWards.id],
    }),
}));
