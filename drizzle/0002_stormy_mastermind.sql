CREATE TABLE `planned_shift_members` (
	`shift_id` text NOT NULL,
	`user_id` text NOT NULL,
	`confirmation_status` text DEFAULT 'pending' NOT NULL,
	`confirmed_at` integer,
	PRIMARY KEY(`shift_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_planned_shift_members_user` ON `planned_shift_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `planned_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`customer_id` text,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`recurrence_group_id` text,
	`created_by` text NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_planned_shifts_date_status` ON `planned_shifts` (`date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_planned_shifts_recurrence` ON `planned_shifts` (`recurrence_group_id`);--> statement-breakpoint
ALTER TABLE `customers` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `customers` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `users` ADD `availability_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
PRAGMA optimize;
