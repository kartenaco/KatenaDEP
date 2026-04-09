import { pgTable, text, integer, serial, real, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"),
  banned: integer("banned").notNull().default(0),
  banReason: text("ban_reason"),
  createdAt: text("created_at").notNull(),
});

// Bank accounts
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  bankName: text("bank_name").notNull(),
  balance: doublePrecision("balance").notNull().default(0),
  color: text("color").notNull().default("#3B82F6"),
  icon: text("icon").notNull().default("wallet"),
});

// Transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id").notNull(),
  toAccountId: integer("to_account_id"),
  type: text("type").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: doublePrecision("amount").notNull(),
  date: text("date").notNull(),
  isRecurring: integer("is_recurring").notNull().default(0),
  recurringFrequency: text("recurring_frequency"),
});

// Monthly snapshots
export const monthlySnapshots = pgTable("monthly_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id").notNull(),
  month: text("month").notNull(),
  openingBalance: doublePrecision("opening_balance").notNull(),
  closingBalance: doublePrecision("closing_balance").notNull(),
  totalIncome: doublePrecision("total_income").notNull(),
  totalExpenses: doublePrecision("total_expenses").notNull(),
});

// Projects (Kanban)
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("waiting"),
  budget: doublePrecision("budget"),
  priority: text("priority").notNull().default("medium"),
  position: integer("position").notNull().default(0),
});

// Shared reports
export const sharedReports = pgTable("shared_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  month: text("month").notNull(),
  sentAt: text("sent_at"),
});

// Contact messages
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
});

// Site settings (key-value)
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// IP logs
export const ipLogs = pgTable("ip_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  ip: text("ip").notNull(),
  userAgent: text("user_agent"),
  action: text("action").notNull().default("login"),
  timestamp: text("timestamp").notNull(),
});

// Blocked IPs
export const blockedIps = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  reason: text("reason"),
  blockedBy: integer("blocked_by").notNull(),
  blockedAt: text("blocked_at").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export const insertMonthlySnapshotSchema = createInsertSchema(monthlySnapshots).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertSharedReportSchema = createInsertSchema(sharedReports).omit({ id: true });
export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true });
export const insertIpLogSchema = createInsertSchema(ipLogs).omit({ id: true });
export const insertBlockedIpSchema = createInsertSchema(blockedIps).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type InsertMonthlySnapshot = z.infer<typeof insertMonthlySnapshotSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type SharedReport = typeof sharedReports.$inferSelect;
export type InsertSharedReport = z.infer<typeof insertSharedReportSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type IpLog = typeof ipLogs.$inferSelect;
export type InsertIpLog = z.infer<typeof insertIpLogSchema>;
export type BlockedIp = typeof blockedIps.$inferSelect;
export type InsertBlockedIp = z.infer<typeof insertBlockedIpSchema>;
