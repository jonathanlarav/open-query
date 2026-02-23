CREATE TABLE `query_log` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`session_id` text,
	`query` text NOT NULL,
	`row_count` integer,
	`execution_time_ms` integer,
	`error` text,
	`executed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `query_log_connection_executed_at_idx` ON `query_log` (`connection_id`,`executed_at`);