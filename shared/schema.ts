import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  uniqueId: text("unique_id").notNull().unique(), // ✅ NEW: unique ID per row
  name: text("name").notNull(),
  skinProblems: text("skin_problems").notNull(),
  phoneNumber: text("phone_number").notNull(),
  generatedMessage: text("generated_message").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, failed
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProspectSchema = createInsertSchema(prospects).omit({
  id: true,
  generatedMessage: true,
  status: true,
}); // ✅ uniqueId is kept

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;
