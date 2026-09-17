CREATE TABLE `access_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`access_date` text NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_access_events_user_date` ON `access_events` (`user_id`,`access_date`);--> statement-breakpoint
CREATE INDEX `idx_access_events_created` ON `access_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`checksum` text NOT NULL,
	`row_counts_json` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`tested_at` integer,
	`test_status` text,
	`test_details` text
);
--> statement-breakpoint
CREATE INDEX `idx_backup_runs_created` ON `backup_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `error_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text,
	`message` text NOT NULL,
	`severity` text DEFAULT 'error' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_error_events_created` ON `error_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_error_events_action` ON `error_events` (`action`);--> statement-breakpoint
CREATE TABLE `pilot_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pilot_feedback_pilot` ON `pilot_feedback` (`pilot_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_pilot_feedback_user` ON `pilot_feedback` (`user_id`);--> statement-breakpoint
CREATE TABLE `pilot_members` (
	`pilot_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invited_at` integer NOT NULL,
	PRIMARY KEY(`pilot_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_pilot_members_user` ON `pilot_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `pilot_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`started_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`closed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_pilot_programs_status` ON `pilot_programs` (`status`);--> statement-breakpoint
CREATE TABLE `privacy_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`controller_name` text DEFAULT 'Barlicious & Koelverhuur' NOT NULL,
	`contact_email` text,
	`location_days` integer DEFAULT 90 NOT NULL,
	`notification_days` integer DEFAULT 180 NOT NULL,
	`audit_days` integer DEFAULT 730 NOT NULL,
	`error_days` integer DEFAULT 180 NOT NULL,
	`backup_days` integer DEFAULT 365 NOT NULL,
	`last_cleanup_at` integer,
	`updated_by` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `shifts` ADD `location_anonymized_at` integer;--> statement-breakpoint
PRAGMA optimize;
