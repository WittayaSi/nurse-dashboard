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
    // Array of DW dimension ward_key integers (e.g., [3, 7])
    hisWardKeys: jsonb('his_ward_keys').$type<number[]>(),
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

// ==========================================
// fact_visits - DW Admissions/Discharges
// ==========================================
export const factVisits = pgTable('fact_visits', {
    visitSk: integer('visit_sk').primaryKey(),
    sourceVisitId: varchar('source_visit_id', { length: 50 }),
    sourceAdmissionId: varchar('source_admission_id', { length: 50 }),
    visitDateKey: integer('visit_date_key'),
    dischargeDateKey: integer('discharge_date_key'),
    patientSk: integer('patient_sk'),
    departmentKey: integer('department_key'),
    wardKey: integer('ward_key'),
    attendingDoctorKey: integer('attending_doctor_key'),
    admissionDoctorKey: integer('admission_doctor_key'),
    ownerDoctorKey: integer('owner_doctor_key'),
    visitType: varchar('visit_type', { length: 20 }),
    lengthOfStay: numeric('length_of_stay'),
    isAdmit: integer('is_admit').default(0),
    isDischarge: integer('is_discharge').default(0),
    visitCount: integer('visit_count').default(1),
    isCancelled: integer('is_cancelled').default(0),
});
