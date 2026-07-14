CREATE TABLE `data_quality_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_file_id` integer,
	`production_date` text,
	`tag` text DEFAULT '' NOT NULL,
	`issue_type` text NOT NULL,
	`severity` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `source_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quality_issue_day_idx` ON `data_quality_issues` (`production_date`,`issue_type`);--> statement-breakpoint
CREATE TABLE `measurement_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag` text NOT NULL,
	`installation_code` text DEFAULT '' NOT NULL,
	`fluid` text DEFAULT '' NOT NULL,
	`primary_measurement` text DEFAULT '' NOT NULL,
	`secondary_measurement` text DEFAULT '' NOT NULL,
	`meter_type` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`flow_computer` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`source_file_id` integer NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `source_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_points_tag_uq` ON `measurement_points` (`tag`);--> statement-breakpoint
CREATE TABLE `mpfm_measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_file_id` integer NOT NULL,
	`source_row` integer NOT NULL,
	`production_date` text NOT NULL,
	`hour` integer,
	`granularity` text NOT NULL,
	`origin` text DEFAULT '' NOT NULL,
	`bank` text DEFAULT '' NOT NULL,
	`loop` text DEFAULT '' NOT NULL,
	`entity` text DEFAULT '' NOT NULL,
	`tag` text NOT NULL,
	`instrument` text DEFAULT '' NOT NULL,
	`gas_t` real,
	`oil_t` real,
	`hc_t` real,
	`water_t` real,
	`total_t` real,
	`pressure_barg` real,
	`temperature_c` real,
	`official` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `source_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mpfm_source_row_uq` ON `mpfm_measurements` (`source_file_id`,`source_row`);--> statement-breakpoint
CREATE INDEX `mpfm_day_tag_grain_idx` ON `mpfm_measurements` (`production_date`,`tag`,`granularity`);--> statement-breakpoint
CREATE TABLE `separator_measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_file_id` integer NOT NULL,
	`source_sheet` text NOT NULL,
	`source_row` integer NOT NULL,
	`production_date` text NOT NULL,
	`hour` integer,
	`phase` text NOT NULL,
	`tag` text NOT NULL,
	`pressure` real,
	`temperature_c` real,
	`standard_volume` real,
	`mass_t` real,
	`flow_time_minutes` real,
	FOREIGN KEY (`source_file_id`) REFERENCES `source_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `separator_source_sheet_row_uq` ON `separator_measurements` (`source_file_id`,`source_sheet`,`source_row`);--> statement-breakpoint
CREATE INDEX `separator_day_phase_idx` ON `separator_measurements` (`production_date`,`phase`,`hour`);--> statement-breakpoint
CREATE TABLE `source_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`sha256` text NOT NULL,
	`source_type` text NOT NULL,
	`source_sheet` text DEFAULT '' NOT NULL,
	`period_start` text,
	`period_end` text,
	`row_count` integer DEFAULT 0 NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_files_sha256_type_uq` ON `source_files` (`sha256`,`source_type`);--> statement-breakpoint
CREATE TABLE `wells` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anp_code` text NOT NULL,
	`anp_name` text DEFAULT '' NOT NULL,
	`operator_name` text DEFAULT '' NOT NULL,
	`field_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`source_file_id` integer NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `source_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wells_anp_code_uq` ON `wells` (`anp_code`);