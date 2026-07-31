CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`receipt_no` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`paid_on` text NOT NULL,
	`notes` text,
	`recorded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_receipt_no_unique` ON `payments` (`receipt_no`);--> statement-breakpoint
CREATE INDEX `idx_payments_booking` ON `payments` (`booking_id`);