import {
  users, accounts, transactions, monthlySnapshots, projects, sharedReports, contactMessages,
  siteSettings, ipLogs, blockedIps,
  type User, type InsertUser,
  type Account, type InsertAccount,
  type Transaction, type InsertTransaction,
  type MonthlySnapshot, type InsertMonthlySnapshot,
  type Project, type InsertProject,
  type SharedReport, type InsertSharedReport,
  type ContactMessage, type InsertContactMessage,
  type SiteSetting, type IpLog, type InsertIpLog,
  type BlockedIp, type InsertBlockedIp,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, sql } from "drizzle-orm";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool);

export interface IStorage {
  init(): Promise<void>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  getAccounts(userId: number): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: number): Promise<void>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactions(userId: number, filters?: { accountId?: number; startDate?: string; endDate?: string; type?: string }): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<void>;
  getSnapshots(userId: number, accountId?: number): Promise<MonthlySnapshot[]>;
  createSnapshot(snapshot: InsertMonthlySnapshot): Promise<MonthlySnapshot>;
  getSnapshotByMonth(userId: number, accountId: number, month: string): Promise<MonthlySnapshot | undefined>;
  getProjects(userId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
  getSharedReports(userId: number): Promise<SharedReport[]>;
  createSharedReport(report: InsertSharedReport): Promise<SharedReport>;
  getContactMessages(): Promise<ContactMessage[]>;
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  updateContactMessageStatus(id: number, status: string): Promise<ContactMessage | undefined>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<SiteSetting[]>;
  logIp(log: InsertIpLog): Promise<IpLog>;
  getIpLogs(userId?: number): Promise<IpLog[]>;
  getAllIpLogs(): Promise<IpLog[]>;
  getBlockedIps(): Promise<BlockedIp[]>;
  blockIp(data: InsertBlockedIp): Promise<BlockedIp>;
  unblockIp(id: number): Promise<void>;
  isIpBlocked(ip: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async init() {
    // Create tables via raw SQL for PostgreSQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#3B82F6',
        icon TEXT NOT NULL DEFAULT 'wallet'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        to_account_id INTEGER,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        amount DOUBLE PRECISION NOT NULL,
        date TEXT NOT NULL,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurring_frequency TEXT
      );
      CREATE TABLE IF NOT EXISTS monthly_snapshots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        opening_balance DOUBLE PRECISION NOT NULL,
        closing_balance DOUBLE PRECISION NOT NULL,
        total_income DOUBLE PRECISION NOT NULL,
        total_expenses DOUBLE PRECISION NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'waiting',
        budget DOUBLE PRECISION,
        priority TEXT NOT NULL DEFAULT 'medium',
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS shared_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        month TEXT NOT NULL,
        sent_at TEXT
      );
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ip_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        ip TEXT NOT NULL,
        user_agent TEXT,
        action TEXT NOT NULL DEFAULT 'login',
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id SERIAL PRIMARY KEY,
        ip TEXT NOT NULL UNIQUE,
        reason TEXT,
        blocked_by INTEGER NOT NULL,
        blocked_at TEXT NOT NULL
      );
    `);

    // Default settings
    const maint = await this.getSetting("maintenance_enabled");
    if (maint === undefined) {
      await this.setSetting("maintenance_enabled", "false");
      await this.setSetting("maintenance_message", "Mise à jour en cours...");
      await this.setSetting("maintenance_progress", "0");
    }

    // Seed demo data if empty
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const count = countResult[0]?.count || 0;
    if (count === 0) {
      await this.seedDemoData();
    }

    // Always ensure admin accounts exist
    const admin = await this.getUserByUsername("admin");
    if (!admin) {
      await db.insert(users).values({
        username: "admin", password: "Kartena&CO2026!0thmaneTheo0@", email: "kartena.co@gmail.com",
        fullName: "KatenaDEP Admin", role: "admin", createdAt: new Date().toISOString(),
      });
    }
    const kartena = await this.getUserByUsername("Kartena");
    if (!kartena) {
      await db.insert(users).values({
        username: "Kartena", password: "Kartena&CO2026!0thmaneTheo0@", email: "blackbeardjimolita@gmail.com",
        fullName: "Th\u00e9o Paris", role: "user", createdAt: new Date().toISOString(),
      });
    }
  }

  private async seedDemoData() {
    const [demoUser] = await db.insert(users).values({
      username: "demo", password: "demo123", email: "demo@katenadep.fr",
      fullName: "Utilisateur Demo", role: "user", createdAt: new Date().toISOString(),
    }).returning();

    await db.insert(users).values({
      username: "admin", password: "Kartena&CO2026!0thmaneTheo0@", email: "kartena.co@gmail.com",
      fullName: "KatenaDEP Admin", role: "admin", createdAt: new Date().toISOString(),
    }).returning();

    const [banquePostale] = await db.insert(accounts).values({
      userId: demoUser.id, name: "Compte Courant", type: "checking",
      bankName: "La Banque Postale", balance: 1875.40, color: "#FFB800", icon: "landmark",
    }).returning();

    const [livretA] = await db.insert(accounts).values({
      userId: demoUser.id, name: "Livret A", type: "livret",
      bankName: "La Banque Postale", balance: 12500.00, color: "#10B981", icon: "piggy-bank",
    }).returning();

    const [bnpCourant] = await db.insert(accounts).values({
      userId: demoUser.id, name: "Compte Courant", type: "checking",
      bankName: "BNP Paribas", balance: 2450.75, color: "#3B82F6", icon: "landmark",
    }).returning();

    await db.insert(accounts).values({
      userId: demoUser.id, name: "Livret Jeune", type: "livret",
      bankName: "Caisse d'Épargne", balance: 1600.00, color: "#EF4444", icon: "piggy-bank",
    }).returning();

    await db.insert(accounts).values({
      userId: demoUser.id, name: "ETF MSCI World", type: "etf",
      bankName: "Trade Republic", balance: 5200.30, color: "#8B5CF6", icon: "trending-up",
    }).returning();

    const [revolut] = await db.insert(accounts).values({
      userId: demoUser.id, name: "Compte Revolut", type: "checking",
      bankName: "Revolut", balance: 340.50, color: "#F59E0B", icon: "credit-card",
    }).returning();

    const now = new Date();
    const months = [0, -1, -2, -3];
    const expenseCategories = ["Loyer", "Courses", "Transport", "Abonnements", "Restaurants", "Loisirs", "Santé", "Shopping"];

    for (const offset of months) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      await db.insert(transactions).values({
        userId: demoUser.id, accountId: banquePostale.id, type: "income",
        category: "Salaire", description: "Paie mensuelle",
        amount: 2100 + Math.round(Math.random() * 200),
        date: `${monthStr}-05`, isRecurring: 1, recurringFrequency: "monthly",
      });

      const recurringExpenses = [
        { cat: "Loyer", desc: "Loyer appartement", amount: 750, day: "01" },
        { cat: "Abonnements", desc: "Netflix", amount: 13.49, day: "15" },
        { cat: "Abonnements", desc: "Spotify", amount: 9.99, day: "15" },
        { cat: "Abonnements", desc: "Xbox Game Pass", amount: 12.99, day: "10" },
        { cat: "Transport", desc: "Pass Navigo", amount: 86.40, day: "01" },
      ];

      for (const exp of recurringExpenses) {
        await db.insert(transactions).values({
          userId: demoUser.id, accountId: banquePostale.id, type: "expense",
          category: exp.cat, description: exp.desc,
          amount: exp.amount, date: `${monthStr}-${exp.day}`,
          isRecurring: 1, recurringFrequency: "monthly",
        });
      }

      const numExpenses = 5 + Math.floor(Math.random() * 8);
      for (let i = 0; i < numExpenses; i++) {
        const cat = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
        await db.insert(transactions).values({
          userId: demoUser.id, accountId: [banquePostale.id, bnpCourant.id, revolut.id][Math.floor(Math.random() * 3)],
          type: "expense", category: cat,
          description: cat === "Courses" ? "Supermarché" : cat === "Restaurants" ? "Restaurant" : cat,
          amount: Math.round((10 + Math.random() * 100) * 100) / 100,
          date: `${monthStr}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`,
          isRecurring: 0,
        });
      }

      if (offset === 0 || offset === -1) {
        await db.insert(transactions).values({
          userId: demoUser.id, accountId: banquePostale.id, toAccountId: livretA.id,
          type: "transfer", category: "Transfert", description: "Épargne mensuelle",
          amount: 200, date: `${monthStr}-10`, isRecurring: 1, recurringFrequency: "monthly",
        });
      }

      for (const acc of [banquePostale, livretA, bnpCourant, revolut]) {
        await db.insert(monthlySnapshots).values({
          userId: demoUser.id, accountId: acc.id, month: monthStr,
          openingBalance: acc.balance - 200 + Math.random() * 400,
          closingBalance: acc.balance + Math.random() * 200 - 100,
          totalIncome: acc.type === "checking" ? 2200 + Math.random() * 300 : Math.random() * 100,
          totalExpenses: acc.type === "checking" ? 1500 + Math.random() * 500 : Math.random() * 50,
        });
      }
    }
  }

  // Users
  async getUser(id: number) { const r = await db.select().from(users).where(eq(users.id, id)); return r[0]; }
  async getUserByUsername(username: string) { const r = await db.select().from(users).where(eq(users.username, username)); return r[0]; }
  async createUser(user: InsertUser) { const r = await db.insert(users).values(user).returning(); return r[0]; }
  async getAllUsers() { return db.select().from(users); }
  async updateUser(id: number, data: Partial<InsertUser>) { const r = await db.update(users).set(data).where(eq(users.id, id)).returning(); return r[0]; }
  async deleteUser(id: number) { await db.delete(users).where(eq(users.id, id)); }

  // Accounts
  async getAccounts(userId: number) { return db.select().from(accounts).where(eq(accounts.userId, userId)); }
  async getAccount(id: number) { const r = await db.select().from(accounts).where(eq(accounts.id, id)); return r[0]; }
  async createAccount(account: InsertAccount) { const r = await db.insert(accounts).values(account).returning(); return r[0]; }
  async updateAccount(id: number, account: Partial<InsertAccount>) { const r = await db.update(accounts).set(account).where(eq(accounts.id, id)).returning(); return r[0]; }
  async deleteAccount(id: number) { await db.delete(accounts).where(eq(accounts.id, id)); }

  // Transactions
  async getTransaction(id: number) { const r = await db.select().from(transactions).where(eq(transactions.id, id)); return r[0]; }
  async getTransactions(userId: number, filters?: { accountId?: number; startDate?: string; endDate?: string; type?: string }) {
    let results = await db.select().from(transactions).where(eq(transactions.userId, userId));
    if (filters?.accountId) results = results.filter(t => t.accountId === filters.accountId || t.toAccountId === filters.accountId);
    if (filters?.startDate) results = results.filter(t => t.date >= filters.startDate!);
    if (filters?.endDate) results = results.filter(t => t.date <= filters.endDate!);
    if (filters?.type) results = results.filter(t => t.type === filters.type);
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }
  async createTransaction(transaction: InsertTransaction) { const r = await db.insert(transactions).values(transaction).returning(); return r[0]; }
  async updateTransaction(id: number, transaction: Partial<InsertTransaction>) { const r = await db.update(transactions).set(transaction).where(eq(transactions.id, id)).returning(); return r[0]; }
  async deleteTransaction(id: number) { await db.delete(transactions).where(eq(transactions.id, id)); }

  // Snapshots
  async getSnapshots(userId: number, accountId?: number) {
    if (accountId) return db.select().from(monthlySnapshots).where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.accountId, accountId)));
    return db.select().from(monthlySnapshots).where(eq(monthlySnapshots.userId, userId));
  }
  async createSnapshot(snapshot: InsertMonthlySnapshot) { const r = await db.insert(monthlySnapshots).values(snapshot).returning(); return r[0]; }
  async getSnapshotByMonth(userId: number, accountId: number, month: string) {
    const r = await db.select().from(monthlySnapshots).where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.accountId, accountId), eq(monthlySnapshots.month, month)));
    return r[0];
  }

  // Projects
  async getProjects(userId: number) { return db.select().from(projects).where(eq(projects.userId, userId)); }
  async createProject(project: InsertProject) { const r = await db.insert(projects).values(project).returning(); return r[0]; }
  async updateProject(id: number, project: Partial<InsertProject>) { const r = await db.update(projects).set(project).where(eq(projects.id, id)).returning(); return r[0]; }
  async deleteProject(id: number) { await db.delete(projects).where(eq(projects.id, id)); }

  // Shared Reports
  async getSharedReports(userId: number) { return db.select().from(sharedReports).where(eq(sharedReports.userId, userId)); }
  async createSharedReport(report: InsertSharedReport) { const r = await db.insert(sharedReports).values(report).returning(); return r[0]; }

  // Contact Messages
  async getContactMessages() { return db.select().from(contactMessages); }
  async createContactMessage(message: InsertContactMessage) { const r = await db.insert(contactMessages).values(message).returning(); return r[0]; }
  async updateContactMessageStatus(id: number, status: string) { const r = await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id)).returning(); return r[0]; }

  // Settings
  async getSetting(key: string) { const r = await db.select().from(siteSettings).where(eq(siteSettings.key, key)); return r[0]?.value; }
  async setSetting(key: string, value: string) {
    const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    if (existing.length > 0) {
      await db.update(siteSettings).set({ value }).where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({ key, value });
    }
  }
  async getAllSettings() { return db.select().from(siteSettings); }

  // IP Logs
  async logIp(log: InsertIpLog) { const r = await db.insert(ipLogs).values(log).returning(); return r[0]; }
  async getIpLogs(userId?: number) {
    if (userId) return db.select().from(ipLogs).where(eq(ipLogs.userId, userId));
    return db.select().from(ipLogs);
  }
  async getAllIpLogs() { return db.select().from(ipLogs); }

  // Blocked IPs
  async getBlockedIps() { return db.select().from(blockedIps); }
  async blockIp(data: InsertBlockedIp) { const r = await db.insert(blockedIps).values(data).returning(); return r[0]; }
  async unblockIp(id: number) { await db.delete(blockedIps).where(eq(blockedIps.id, id)); }
  async isIpBlocked(ip: string) { const r = await db.select().from(blockedIps).where(eq(blockedIps.ip, ip)); return r.length > 0; }
}

export const storage = new DatabaseStorage();
