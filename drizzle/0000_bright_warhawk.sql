CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`bucket` text NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rl_pk` ON `rate_limits` (`key`,`bucket`);--> statement-breakpoint
CREATE INDEX `rl_expires_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `whitelist_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`minecraft_username` text NOT NULL,
	`discord_handle` text NOT NULL,
	`age` integer NOT NULL,
	`why_join` text NOT NULL,
	`referrer` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_at` integer,
	`ip_hash` text NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wl_status_idx` ON `whitelist_applications` (`status`);--> statement-breakpoint
CREATE INDEX `wl_created_idx` ON `whitelist_applications` (`created_at`);--> statement-breakpoint
CREATE INDEX `wl_mc_username_idx` ON `whitelist_applications` (`minecraft_username`);