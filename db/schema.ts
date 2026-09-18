import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(),
  firstName: text("first_name"), lastName: text("last_name"), address: text("address"),
  phone: text("phone"), role: text("role").notNull(), active: integer("active").notNull().default(1),
  availability: text("availability"), availabilityJson: text("availability_json").notNull().default("{}"), createdAt: integer("created_at").notNull(),
}, table => [uniqueIndex("idx_users_email").on(table.email)]);
