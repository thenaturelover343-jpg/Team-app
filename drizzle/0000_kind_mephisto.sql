CREATE TABLE `active_shifts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`description` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`arrival_time` integer,
	`departure_time` integer,
	`arrival_lat` real,
	`arrival_lng` real,
	`departure_lat` real,
	`departure_lng` real,
	`work_notes` text,
	`tasks_json` text DEFAULT '[]' NOT NULL,
	`acknowledged` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`phone` text,
	`email` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`role` text DEFAULT 'employee' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invites_email` ON `invites` (`email`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`clock_in` integer NOT NULL,
	`clock_in_lat` real NOT NULL,
	`clock_in_lng` real NOT NULL,
	`clock_out` integer,
	`clock_out_lat` real,
	`clock_out_lng` real,
	`status_tag` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`availability` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);