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
  checklistJson: text("checklist_json").notNull().default("[]"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, table => [
  index("idx_planned_shifts_date_status").on(table.date, table.status),
  index("idx_planned_shifts_recurrence").on(table.recurrenceGroupId),
]);

export const plannedShiftMembers = sqliteTable("planned_shift_members", {
  shiftId: text("shift_id").notNull(), userId: text("user_id").notNull(),
  confirmationStatus: text("confirmation_status").notNull().default("pending"), confirmedAt: integer("confirmed_at"),
  checklistStateJson: text("checklist_state_json").notNull().default("[]"),
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
  plannedShiftId: text("planned_shift_id"), clockInLat: real("clock_in_lat").notNull(), clockInLng: real("clock_in_lng").notNull(),
  clockInAccuracy: real("clock_in_accuracy"), clockInDistance: real("clock_in_distance"), clockInClientAt: integer("clock_in_client_at"),
  clockOut: integer("clock_out"), clockOutLat: real("clock_out_lat"), clockOutLng: real("clock_out_lng"),
  clockOutAccuracy: real("clock_out_accuracy"), clockOutDistance: real("clock_out_distance"), clockOutClientAt: integer("clock_out_client_at"),
  geofenceStatus: text("geofence_status"), statusTag: text("status_tag"), notes: text("notes"),
}, table => [index("idx_shifts_user_clock").on(table.userId, table.clockIn)]);

export const timesheetApprovals = sqliteTable("timesheet_approvals", {
  shiftId: text("shift_id").primaryKey(), status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"), reviewedAt: integer("reviewed_at"), adminNote: text("admin_note"),
  updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_timesheet_approvals_status").on(table.status, table.updatedAt)]);

export const activeShifts = sqliteTable("active_shifts", {
  userId: text("user_id").primaryKey(), shiftId: text("shift_id").notNull(),
});

export const shiftBreaks = sqliteTable("shift_breaks", {
  id: text("id").primaryKey(), shiftId: text("shift_id").notNull(), userId: text("user_id").notNull(),
  startedAt: integer("started_at").notNull(), endedAt: integer("ended_at"), createdAt: integer("created_at").notNull(),
}, table => [index("idx_shift_breaks_shift").on(table.shiftId), index("idx_shift_breaks_user").on(table.userId)]);

export const activeBreaks = sqliteTable("active_breaks", {
  userId: text("user_id").primaryKey(), breakId: text("break_id").notNull(), shiftId: text("shift_id").notNull(),
});

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), plannedShiftId: text("planned_shift_id"),
  category: text("category").notNull(), severity: text("severity").notNull(), description: text("description").notNull(),
  status: text("status").notNull().default("open"), latitude: real("latitude"), longitude: real("longitude"),
  accuracy: real("accuracy"), occurredAt: integer("occurred_at").notNull(), createdAt: integer("created_at").notNull(),
}, table => [index("idx_incidents_user_created").on(table.userId, table.createdAt), index("idx_incidents_status").on(table.status)]);

export const correctionRequests = sqliteTable("correction_requests", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), shiftId: text("shift_id").notNull(),
  requestedClockIn: integer("requested_clock_in"), requestedClockOut: integer("requested_clock_out"),
  reason: text("reason").notNull(), status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"), reviewedAt: integer("reviewed_at"), createdAt: integer("created_at").notNull(),
}, table => [index("idx_correction_requests_user").on(table.userId, table.createdAt), index("idx_correction_requests_status").on(table.status)]);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(), objectKey: text("object_key").notNull(), filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(), size: integer("size").notNull(), createdAt: integer("created_at").notNull(),
}, table => [index("idx_attachments_entity").on(table.entityType, table.entityId), index("idx_attachments_user").on(table.userId)]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), type: text("type").notNull(),
  title: text("title").notNull(), body: text("body").notNull(), entityType: text("entity_type"),
  entityId: text("entity_id"), dedupeKey: text("dedupe_key").notNull(), readAt: integer("read_at"),
  pushStatus: text("push_status").notNull().default("pending"), createdAt: integer("created_at").notNull(),
}, table => [
  uniqueIndex("idx_notifications_dedupe").on(table.dedupeKey),
  index("idx_notifications_user_created").on(table.userId, table.createdAt),
  index("idx_notifications_user_read").on(table.userId, table.readAt),
]);

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(), auth: text("auth").notNull(), userAgent: text("user_agent"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, table => [uniqueIndex("idx_push_subscriptions_endpoint").on(table.endpoint), index("idx_push_subscriptions_user").on(table.userId)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), action: text("action").notNull(),
  targetType: text("target_type").notNull(), targetId: text("target_id").notNull(), detailsJson: text("details_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
}, table => [index("idx_audit_events_created").on(table.createdAt), index("idx_audit_events_actor").on(table.actorId)]);
