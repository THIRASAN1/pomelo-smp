CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`ip_hash` text NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `adm_expires_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `whitelist_applications` ADD `reviewed_by` text;