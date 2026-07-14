CREATE TABLE `calibration_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` text NOT NULL,
	`revision` text DEFAULT '' NOT NULL,
	`nature` text DEFAULT '' NOT NULL,
	`asset` text DEFAULT '' NOT NULL,
	`well` text DEFAULT '' NOT NULL,
	`tag` text NOT NULL,
	`serial` text DEFAULT '' NOT NULL,
	`reference_tag` text DEFAULT '' NOT NULL,
	`start_at` text,
	`end_at` text,
	`post_start_at` text,
	`post_end_at` text,
	`pb_barg` real,
	`hc_limit_pct` real,
	`total_limit_pct` real,
	`pvt_limit_pct` real,
	`k_min` real,
	`k_max` real,
	`min_records` integer,
	`pvt_months` integer,
	`timezone` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`approver` text DEFAULT '' NOT NULL,
	`envelope_p_min` real,
	`envelope_p_max` real,
	`envelope_t_min` real,
	`envelope_t_max` real,
	`envelope_dp_min` real,
	`envelope_dp_max` real,
	`envelope_gvf_min` real,
	`envelope_gvf_max` real,
	`envelope_wlr_min` real,
	`envelope_wlr_max` real,
	`evidence` integer DEFAULT false NOT NULL,
	`approvals` integer DEFAULT false NOT NULL,
	`source_file_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `source_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calibration_campaigns_campaign_id_uq` ON `calibration_campaigns` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `calibration_campaigns_tag_idx` ON `calibration_campaigns` (`tag`);--> statement-breakpoint
CREATE TABLE `calibration_k_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`phase` text NOT NULL,
	`k_calculated` real,
	`k_approved` real,
	`k_applied` real,
	`applied_at` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`system` text DEFAULT '' NOT NULL,
	`config_version` text DEFAULT '' NOT NULL,
	`evidence_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `calibration_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calibration_k_applications_uq` ON `calibration_k_applications` (`campaign_id`,`phase`);--> statement-breakpoint
CREATE TABLE `calibration_lab_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`sample_id` text DEFAULT '' NOT NULL,
	`use_flag` integer DEFAULT true NOT NULL,
	`sampled_at` text DEFAULT '' NOT NULL,
	`sample_type` text DEFAULT '' NOT NULL,
	`bsw_pct` real,
	`rho_oil_std_kgm3` real,
	`rho_gas_std_kgsm3` real,
	`rho_water_std_kgm3` real,
	`fe` real,
	`rs` real,
	`method` text DEFAULT '' NOT NULL,
	`report_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `calibration_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `calibration_mpfm_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`condition` text NOT NULL,
	`timestamp` text NOT NULL,
	`use_flag` integer DEFAULT true NOT NULL,
	`duration_h` real,
	`quality` text DEFAULT '' NOT NULL,
	`pressure_barg` real,
	`temperature_c` real,
	`dp_kpa` real,
	`gvf_pct` real,
	`wlr_pct` real,
	`oil_uncorr_t` real,
	`gas_uncorr_t` real,
	`water_uncorr_t` real,
	`oil_corr_t` real,
	`gas_corr_t` real,
	`water_corr_t` real,
	FOREIGN KEY (`campaign_id`) REFERENCES `calibration_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calibration_mpfm_rows_uq` ON `calibration_mpfm_rows` (`campaign_id`,`condition`,`timestamp`);--> statement-breakpoint
CREATE TABLE `calibration_pvt_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`condition` text NOT NULL,
	`file` text DEFAULT '' NOT NULL,
	`sha256` text DEFAULT '' NOT NULL,
	`software` text DEFAULT '' NOT NULL,
	`version` text DEFAULT '' NOT NULL,
	`eos_model` text DEFAULT '' NOT NULL,
	`loaded_at` text DEFAULT '' NOT NULL,
	`approver` text DEFAULT '' NOT NULL,
	`input_oil_t` real,
	`input_gas_t` real,
	`input_water_t` real,
	`output_oil_t` real,
	`output_gas_t` real,
	`output_water_t` real,
	`pb_barg` real,
	`responded_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `calibration_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calibration_pvt_records_uq` ON `calibration_pvt_records` (`campaign_id`,`condition`);--> statement-breakpoint
CREATE TABLE `calibration_separator_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`condition` text NOT NULL,
	`timestamp` text NOT NULL,
	`use_flag` integer DEFAULT true NOT NULL,
	`duration_h` real,
	`quality` text DEFAULT '' NOT NULL,
	`pressure_barg` real,
	`temperature_c` real,
	`oil_gv_line_m3` real,
	`oil_rho_coriolis_kgm3` real,
	`oil_mass_direct_t` real,
	`gas_mass_t` real,
	`water_mass_t` real,
	`gas_std_ksm3` real,
	`water_vol_m3` real,
	`source_ref` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `calibration_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calibration_separator_rows_uq` ON `calibration_separator_rows` (`campaign_id`,`condition`,`timestamp`);--> statement-breakpoint
CREATE TABLE `calibration_uncertainty` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`condition` text NOT NULL,
	`u_mpfm_hc_pp` real,
	`u_mpfm_total_pp` real,
	`u_ref_hc_pp` real,
	`u_ref_total_pp` real,
	`k_mpfm` real,
	`k_ref` real,
	`source_version` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `calibration_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calibration_uncertainty_uq` ON `calibration_uncertainty` (`campaign_id`,`condition`);