CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`event_type` text,
	`preferred_date` text,
	`preferred_slot` text,
	`guest_estimate` integer,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`close_reason` text,
	`follow_up_date` text,
	`converted_booking_id` text,
	`received_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`converted_booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inquiries_status` ON `inquiries` (`status`,`received_at`);--> statement-breakpoint
CREATE TABLE `inquiry_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiry_id` text NOT NULL,
	`note` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inquiry_id`) REFERENCES `inquiries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inquiry_notes_inquiry` ON `inquiry_notes` (`inquiry_id`);--> statement-breakpoint
CREATE TABLE `notification_reads` (
	`notification_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer NOT NULL,
	PRIMARY KEY(`notification_id`, `user_id`),
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notif_reads_user` ON `notification_reads` (`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notif_created` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `quotation_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` text NOT NULL,
	`kind` text NOT NULL,
	`service_id` text,
	`label` text NOT NULL,
	`qty` integer NOT NULL,
	`rate` integer NOT NULL,
	`line_total` integer NOT NULL,
	`taxable` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_quotation_lines_quotation` ON `quotation_lines` (`quotation_id`);--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_no` text NOT NULL,
	`client_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`event_type` text,
	`event_date_pref` text,
	`event_slot_pref` text,
	`hall_pref` text,
	`guest_count` integer,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`grand_total` integer DEFAULT 0 NOT NULL,
	`valid_until` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`converted_booking_id` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`converted_booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_quote_no_unique` ON `quotations` (`quote_no`);--> statement-breakpoint
CREATE INDEX `idx_quotations_no` ON `quotations` (`quote_no`);--> statement-breakpoint
CREATE INDEX `idx_quotations_status` ON `quotations` (`status`,`valid_until`);