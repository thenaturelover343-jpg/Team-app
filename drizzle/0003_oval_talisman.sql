CREATE TABLE `active_breaks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`break_id` text NOT NULL,
	`shift_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_entity` ON `attachments` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_attachments_user` ON `attachments` (`user_id`);--> statement-breakpoint
CREATE TABLE `correction_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`requested_clock_in` integer,
	`requested_clock_out` integer,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_correction_requests_user` ON `correction_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_correction_requests_status` ON `correction_requests` (`status`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`planned_shift_id` text,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_incidents_user_created` ON `incidents` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_incidents_status` ON `incidents` (`status`);--> statement-breakpoint
CREATE TABLE `shift_breaks` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`user_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shift_breaks_shift` ON `shift_breaks` (`shift_id`);--> statement-breakpoint
CREATE INDEX `idx_shift_breaks_user` ON `shift_breaks` (`user_id`);--> statement-breakpoint
ALTER TABLE `planned_shift_members` ADD `checklist_state_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `planned_shifts` ADD `checklist_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `planned_shift_id` text;--> statement-breakpoint
ALTER TABLE `shifts` ADD `clock_in_accuracy` real;--> statement-breakpoint
ALTER TABLE `shifts` ADD `clock_in_distance` real;--> statement-breakpoint
ALTER TABLE `shifts` ADD `clock_in_client_at` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `clock_out_accuracy` real;--> statement-breakpoint
ALTER TABLE `shifts` ADD `clock_out_distance` real;--> statement-breakpoint
ALTER TABLE `shifts` ADD `clock_out_client_at` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `geofence_status` text;--> statement-breakpoint
PRAGMA optimize;
