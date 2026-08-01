CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_date` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`vendor` text,
	`method` text,
	`reference` text,
	`booking_id` text,
	`receipt_path` text,
	`is_recurring` integer DEFAULT 0 NOT NULL,
	`paid_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_date` ON `expenses` (`expense_date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_booking` ON `expenses` (`booking_id`);--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_installments_bkg` ON `installments` (`booking_id`,`due_date`);--> statement-breakpoint
ALTER TABLE `payments` ADD `installment_id` text REFERENCES installments(id);