CREATE TABLE `analysis_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`current_step` text,
	`total_tables` integer DEFAULT 0 NOT NULL,
	`processed_tables` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analysis_jobs_connection_created_at_idx` ON `analysis_jobs` (`connection_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `column_context` ADD `data_profile_json` text;--> statement-breakpoint
CREATE UNIQUE INDEX `column_context_connection_table_column_uniq` ON `column_context` (`connection_id`,`table_name`,`column_name`);