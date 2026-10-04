import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Infrastructure only. Inventory and recommendation models await source review.
export const applicationInfo = pgTable("application_info", {
  id: uuid("id").primaryKey(),
  application: text("application").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
