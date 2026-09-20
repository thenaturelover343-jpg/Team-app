ALTER TABLE `invites` ADD `token` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invites_token` ON `invites` (`token`);
