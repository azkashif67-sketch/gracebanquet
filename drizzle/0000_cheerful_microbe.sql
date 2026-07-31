CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`module` text NOT NULL,
	`record_id` text,
	`summary` text NOT NULL,
	`changes` text,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `booking_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`label` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`rate` integer NOT NULL,
	`line_total` integer NOT NULL,
	`taxable` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_extras_booking` ON `booking_extras` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_menu` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`item_name` text NOT NULL,
	`type` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_menu_booking` ON `booking_menu` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_services` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`service_id` text NOT NULL,
	`service_name` text NOT NULL,
	`pricing_type` text NOT NULL,
	`qty` integer NOT NULL,
	`rate` integer NOT NULL,
	`line_total` integer NOT NULL,
	`taxable` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bs_booking` ON `booking_services` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_taxes` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`tax_id` text NOT NULL,
	`tax_name` text NOT NULL,
	`rate` integer NOT NULL,
	`tax_amount` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_id`) REFERENCES `taxes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_booking_taxes` ON `booking_taxes` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text,
	`client_name` text NOT NULL,
	`phone` text NOT NULL,
	`alt_phone` text,
	`cnic` text,
	`address` text,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`event_slot` text NOT NULL,
	`hall_section` text NOT NULL,
	`guest_count` integer NOT NULL,
	`start_time` text,
	`end_time` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`discount_reason` text,
	`taxable_amount` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`grand_total` integer DEFAULT 0 NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`balance_due` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`hold_expires_on` text,
	`cancelled_at` integer,
	`cancel_reason` text,
	`advance_handling` text,
	`refund_amount` integer,
	`internal_notes` text,
	`client_notes` text,
	`special_instructions` text,
	`google_event_id` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_invoice_no_unique` ON `bookings` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `idx_bookings_availability` ON `bookings` (`event_date`,`event_slot`,`hall_section`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bookings_invoice` ON `bookings` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `idx_bookings_phone` ON `bookings` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_bookings_dues` ON `bookings` (`status`,`due_date`,`balance_due`);--> statement-breakpoint
CREATE INDEX `idx_bookings_created` ON `bookings` (`created_at`);--> statement-breakpoint
CREATE TABLE `counters` (
	`name` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`per_head_price` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`pricing_type` text NOT NULL,
	`rate` integer NOT NULL,
	`taxable` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_services_name_category` ON `services` (`name`,`category`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `taxes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`rate` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`active` integer DEFAULT 1 NOT NULL,
	`must_change_password` integer DEFAULT 0 NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`last_login` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);