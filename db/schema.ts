import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(),
  phone: text("phone"), role: text("role").notNull(), active: integer("active").notNull().default(1),
  availability: text("availability"), availabilityJson: text("availability_json").notNull().default("{}"), createdAt: integer("created_at").notNull(),
}, table => [uniqueIndex("idx_users_email").on(table.email)]);

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(), phone: text("phone"),
  role: text("role").notNull().default("employee"), status: text("status").notNull().default("pending"),
  invitedBy: text("invited_by").notNull(), createdAt: integer("created_at").notNull(), acceptedAt: integer("accepted_at"),
}, table => [uniqueIndex("idx_invites_email").on(table.email)]);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(), name: text("name").notNull(), address: text("address").notNull(),
  phone: text("phone"), email: text("email"), latitude: real("latitude"), longitude: real("longitude"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
});

export const plannedShifts = sqliteTable("planned_shifts", {
  id: text("id").primaryKey(), title: text("title").notNull(), customerId: text("customer_id"),
  date: text("date").notNull(), startTime: text("start_time").notNull(), endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").notNull().default(0), notes: text("notes"),
  status: text("status").notNull().default("draft"), recurrenceGroupId: text("recurrence_group_id"),
  createdBy: text("created_by").notNull(), publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, table => [
  index("idx_planned_shifts_date_status").on(table.date, table.status),
  index("idx_planned_shifts_recurrence").on(table.recurrenceGroupId),
]);

export const plannedShiftMembers = sqliteTable("planned_shift_members", {
  shiftId: text("shift_id").notNull(), userId: text("user_id").notNull(),
  confirmationStatus: text("confirmation_status").notNull().default("pending"), confirmedAt: integer("confirmed_at"),
}, table => [
  primaryKey({ columns: [table.shiftId, table.userId] }),
  index("idx_planned_shift_members_user").on(table.userId),
]);

export const assignments = sqliteTable("assignments", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), customerId: text("customer_id").notNull(),
  description: text("description").notNull(), date: text("date").notNull(), startTime: text("start_time"),
  status: text("status").notNull().default("pending"), arrivalTime: integer("arrival_time"), departureTime: integer("departure_time"),
  arrivalLat: real("arrival_lat"), arrivalLng: real("arrival_lng"), departureLat: real("departure_lat"), departureLng: real("departure_lng"),
  workNotes: text("work_notes"), tasksJson: text("tasks_json").notNull().default("[]"), acknowledged: integer("acknowledged").notNull().default(0),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_assignments_user_date").on(table.userId, table.date), index("idx_assignments_status").on(table.status)]);

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), clockIn: integer("clock_in").notNull(),
  clockInLat: real("clock_in_lat").notNull(), clockInLng: real("clock_in_lng").notNull(), clockOut: integer("clock_out"),
  clockOutLat: real("clock_out_lat"), clockOutLng: real("clock_out_lng"), statusTag: text("status_tag"), notes: text("notes"),
}, table => [index("idx_shifts_user_clock").on(table.userId, table.clockIn)]);

export const activeShifts = sqliteTable("active_shifts", {
  userId: text("user_id").primaryKey(), shiftId: text("shift_id").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), action: text("action").notNull(),
  targetType: text("target_type").notNull(), targetId: text("target_id").notNull(), detailsJson: text("details_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
}, table => [index("idx_audit_events_created").on(table.createdAt), index("idx_audit_events_actor").on(table.actorId)]);
