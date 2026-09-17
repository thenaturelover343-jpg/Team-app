CREATE INDEX `idx_assignments_user_date` ON `assignments` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_assignments_status` ON `assignments` (`status`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_created` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_actor` ON `audit_events` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_shifts_user_clock` ON `shifts` (`user_id`,`clock_in`);--> statement-breakpoint
PRAGMA optimize;
