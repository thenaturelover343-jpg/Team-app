ALTER TABLE `assignments` ADD `site_address` text;--> statement-breakpoint
ALTER TABLE `assignments` ADD `site_latitude` real;--> statement-breakpoint
ALTER TABLE `assignments` ADD `site_longitude` real;--> statement-breakpoint
ALTER TABLE `assignments` ADD `materials` text;--> statement-breakpoint
ALTER TABLE `assignments` ADD `completion_notes` text;--> statement-breakpoint
ALTER TABLE `planned_shifts` ADD `site_address` text;--> statement-breakpoint
ALTER TABLE `planned_shifts` ADD `site_latitude` real;--> statement-breakpoint
ALTER TABLE `planned_shifts` ADD `site_longitude` real;--> statement-breakpoint
ALTER TABLE `attachments` ADD `data_url` text;--> statement-breakpoint
PRAGMA optimize;
