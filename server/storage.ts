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
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, sql } from "drizzle-orm";

const sqlite = new Database("econogest.db");
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

export interface IStorage {
  getUser(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  createUser(user: InsertUser): User;
  getAllUsers(): User[];
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;
  deleteUser(id: number): void;
  getAccounts(userId: number): Account[];
  getAccount(id: number): Account | undefined;
  createAccount(account: InsertAccount): Account;
  updateAccount(id: number, account: Partial<InsertAccount>): Account | undefined;
  deleteAccount(id: number): void;
  getTransaction(id: number): Transaction | undefined;
  getTransactions(userId: number, filters?: { accountId?: number; startDate?: string; endDate?: string; type?: string }): Transaction[];
  createTransaction(transaction: InsertTransaction): Transaction;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Transaction | undefined;
  deleteTransaction(id: number): void;
  getSnapshots(userId: number, accountId?: number): MonthlySnapshot[];
  createSnapshot(snapshot: InsertMonthlySnapshot): MonthlySnapshot;
  getSnapshotByMonth(userId: number, accountId: number, month: string): MonthlySnapshot | undefined;
  getProjects(userId: number): Project[];
  createProject(project: InsertProject): Project;
  updateProject(id: number, project: Partial<InsertProject>): Project | undefined;
  deleteProject(id: number): void;
  getSharedReports(userId: number): SharedReport[];
  createSharedReport(report: InsertSharedReport): SharedReport;
  getContactMessages(): ContactMessage[];
  createContactMessage(message: InsertContactMessage): ContactMessage;
  updateContactMessageStatus(id: number, status: string): ContactMessage | undefined;
  // Settings
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
  getAllSettings(): SiteSetting[];
  // IP Logs
  logIp(log: InsertIpLog): IpLog;
  getIpLogs(userId?: number): IpLog[];
  getAllIpLogs(): IpLog[];
  // Blocked IPs
  getBlockedIps(): BlockedIp[];
  blockIp(data: InsertBlockedIp): BlockedIp;
  unblockIp(id: number): void;
  isIpBlocked(ip: string): boolean;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#3B82F6',
        icon TEXT NOT NULL DEFAULT 'wallet'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        to_account_id INTEGER,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurring_frequency TEXT
      );
      CREATE TABLE IF NOT EXISTS monthly_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        opening_balance REAL NOT NULL,
        closing_balance REAL NOT NULL,
        total_income REAL NOT NULL,
        total_expenses REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'waiting',
        budget REAL,
        priority TEXT NOT NULL DEFAULT 'medium',
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS shared_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        month TEXT NOT NULL,
        sent_at TEXT
      );
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        ip TEXT NOT NULL,
        user_agent TEXT,
        action TEXT NOT NULL DEFAULT 'login',
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL UNIQUE,
        reason TEXT,
        blocked_by INTEGER NOT NULL,
        blocked_at TEXT NOT NULL
      );
    `);

    // Migrations for existing DBs
    try { sqlite.exec(`ALTER TABLE transactions ADD COLUMN to_account_id INTEGER`); } catch {}

    // Default settings
    const maint = this.getSetting("maintenance_enabled");
    if (maint === undefined) {
      this.setSetting("maintenance_enabled", "false");
      this.setSetting("maintenance_message", "Mise à jour en cours...");
      this.setSetting("maintenance_progress", "0");
    }

    // Seed demo data if empty
    const userCount = db.select({ count: sql<number>`count(*)` }).from(users).get();
    if (!userCount || userCount.count === 0) {
      this.seedDemoData();
    }
  }

  private seedDemoData() {
    const demoUser = db.insert(users).values({
      username: "demo", password: "demo123", email: "demo@katenadep.fr",
      fullName: "Utilisateur Demo", role: "user", createdAt: new Date().toISOString(),
    }).returning().get();

    db.insert(users).values({
      username: "admin", password: "Kartena&CO2026!0thmaneThé0@", email: "kartena.co@gmail.com",
      fullName: "KatenaDEP Admin", role: "admin", createdAt: new Date().toISOString(),
    }).returning().get();

    // Bank accounts
    const banquePostale = db.insert(accounts).values({
      userId: demoUser.id, name: "Compte Courant", type: "checking",
      bankName: "La Banque Postale", balance: 1875.40, color: "#FFB800", icon: "landmark",
    }).returning().get();

    const livretA = db.insert(accounts).values({
      userId: demoUser.id, name: "Livret A", type: "livret",
      bankName: "La Banque Postale", balance: 12500.00, color: "#10B981", icon: "piggy-bank",
    }).returning().get();

    const bnpCourant = db.insert(accounts).values({
      userId: demoUser.id, name: "Compte Courant", type: "checking",
      bankName: "BNP Paribas", balance: 2450.75, color: "#3B82F6", icon: "landmark",
    }).returning().get();

    db.insert(accounts).values({
      userId: demoUser.id, name: "Livret Jeune", type: "livret",
      bankName: "Caisse d'Épargne", balance: 1600.00, color: "#EF4444", icon: "piggy-bank",
    }).returning().get();

    db.insert(accounts).values({
      userId: demoUser.id, name: "ETF MSCI World", type: "etf",
      bankName: "Trade Republic", balance: 5200.30, color: "#8B5CF6", icon: "trending-up",
    }).returning().get();

    const revolut = db.insert(accounts).values({
      userId: demoUser.id, name: "Compte Revolut", type: "checking",
      bankName: "Revolut", balance: 340.50, color: "#F59E0B", icon: "credit-card",
    }).returning().get();

    const now = new Date();
    const months = [0, -1, -2, -3];
    const expenseCategories = ["Loyer", "Courses", "Transport", "Abonnements", "Restaurants", "Loisirs", "Santé", "Shopping"];

    for (const offset of months) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      db.insert(transactions).values({
        userId: demoUser.id, accountId: banquePostale.id, type: "income",
        category: "Salaire", description: "Paie mensuelle",
        amount: 2100 + Math.round(Math.random() * 200),
        date: `${monthStr}-05`, isRecurring: 1, recurringFrequency: "monthly",
      }).run();

      const recurringExpenses = [
        { cat: "Loyer", desc: "Loyer appartement", amount: 750, day: "01" },
        { cat: "Abonnements", desc: "Netflix", amount: 13.49, day: "15" },
        { cat: "Abonnements", desc: "Spotify", amount: 9.99, day: "15" },
        { cat: "Abonnements", desc: "Xbox Game Pass", amount: 12.99, day: "10" },
        { cat: "Transport", desc: "Pass Navigo", amount: 86.40, day: "01" },
      ];

      for (const exp of recurringExpenses) {
        db.insert(transactions).values({
          userId: demoUser.id, accountId: banquePostale.id, type: "expense",
          category: exp.cat, description: exp.desc,
          amount: exp.amount, date: `${monthStr}-${exp.day}`,
          isRecurring: 1, recurringFrequency: "monthly",
        }).run();
      }

      const numExpenses = 5 + Math.floor(Math.random() * 8);
      for (let i = 0; i < numExpenses; i++) {
        const cat = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
        db.insert(transactions).values({
          userId: demoUser.id, accountId: [banquePostale.id, bnpCourant.id, revolut.id][Math.floor(Math.random() * 3)],
          type: "expense", category: cat,
          description: cat === "Courses" ? "Supermarché" : cat === "Restaurants" ? "Restaurant" : cat,
          amount: Math.round((10 + Math.random() * 100) * 100) / 100,
          date: `${monthStr}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`,
          isRecurring: 0,
        }).run();
      }

      if (offset === 0 || offset === -1) {
        db.insert(transactions).values({
          userId: demoUser.id, accountId: banquePostale.id, toAccountId: livretA.id,
          type: "transfer", category: "Transfert", description: "Épargne mensuelle",
          amount: 200, date: `${monthStr}-10`, isRecurring: 1, recurringFrequency: "monthly",
        }).run();
      }

      for (const acc of [banquePostale, livretA, bnpCourant, revolut]) {
        db.insert(monthlySnapshots).values({
          userId: demoUser.id, accountId: acc.id, month: monthStr,
          openingBalance: acc.balance - 200 + Math.random() * 400,
          closingBalance: acc.balance + Math.random() * 200 - 100,
          totalIncome: acc.type === "checking" ? 2200 + Math.random() * 300 : Math.random() * 100,
          totalExpenses: acc.type === "checking" ? 1500 + Math.random() * 500 : Math.random() * 50,
        }).run();
      }
    }
  }

  // Users
  getUser(id: number): User | undefined { return db.select().from(users).where(eq(users.id, id)).get(); }
  getUserByUsername(username: string): User | undefined { return db.select().from(users).where(eq(users.username, username)).get(); }
  createUser(user: InsertUser): User { return db.insert(users).values(user).returning().get(); }
  getAllUsers(): User[] { return db.select().from(users).all(); }
  updateUser(id: number, data: Partial<InsertUser>): User | undefined {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }
  deleteUser(id: number): void { db.delete(users).where(eq(users.id, id)).run(); }

  // Accounts
  getAccounts(userId: number): Account[] { return db.select().from(accounts).where(eq(accounts.userId, userId)).all(); }
  getAccount(id: number): Account | undefined { return db.select().from(accounts).where(eq(accounts.id, id)).get(); }
  createAccount(account: InsertAccount): Account { return db.insert(accounts).values(account).returning().get(); }
  updateAccount(id: number, account: Partial<InsertAccount>): Account | undefined {
    return db.update(accounts).set(account).where(eq(accounts.id, id)).returning().get();
  }
  deleteAccount(id: number): void { db.delete(accounts).where(eq(accounts.id, id)).run(); }

  // Transactions
  getTransaction(id: number): Transaction | undefined { return db.select().from(transactions).where(eq(transactions.id, id)).get(); }
  getTransactions(userId: number, filters?: { accountId?: number; startDate?: string; endDate?: string; type?: string }): Transaction[] {
    let results = db.select().from(transactions).where(eq(transactions.userId, userId)).all();
    if (filters?.accountId) results = results.filter(t => t.accountId === filters.accountId || t.toAccountId === filters.accountId);
    if (filters?.startDate) results = results.filter(t => t.date >= filters.startDate!);
    if (filters?.endDate) results = results.filter(t => t.date <= filters.endDate!);
    if (filters?.type) results = results.filter(t => t.type === filters.type);
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }
  createTransaction(transaction: InsertTransaction): Transaction { return db.insert(transactions).values(transaction).returning().get(); }
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Transaction | undefined {
    return db.update(transactions).set(transaction).where(eq(transactions.id, id)).returning().get();
  }
  deleteTransaction(id: number): void { db.delete(transactions).where(eq(transactions.id, id)).run(); }

  // Snapshots
  getSnapshots(userId: number, accountId?: number): MonthlySnapshot[] {
    if (accountId) return db.select().from(monthlySnapshots).where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.accountId, accountId))).all();
    return db.select().from(monthlySnapshots).where(eq(monthlySnapshots.userId, userId)).all();
  }
  createSnapshot(snapshot: InsertMonthlySnapshot): MonthlySnapshot { return db.insert(monthlySnapshots).values(snapshot).returning().get(); }
  getSnapshotByMonth(userId: number, accountId: number, month: string): MonthlySnapshot | undefined {
    return db.select().from(monthlySnapshots).where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.accountId, accountId), eq(monthlySnapshots.month, month))).get();
  }

  // Projects
  getProjects(userId: number): Project[] { return db.select().from(projects).where(eq(projects.userId, userId)).all(); }
  createProject(project: InsertProject): Project { return db.insert(projects).values(project).returning().get(); }
  updateProject(id: number, project: Partial<InsertProject>): Project | undefined {
    return db.update(projects).set(project).where(eq(projects.id, id)).returning().get();
  }
  deleteProject(id: number): void { db.delete(projects).where(eq(projects.id, id)).run(); }

  // Shared Reports
  getSharedReports(userId: number): SharedReport[] { return db.select().from(sharedReports).where(eq(sharedReports.userId, userId)).all(); }
  createSharedReport(report: InsertSharedReport): SharedReport { return db.insert(sharedReports).values(report).returning().get(); }

  // Contact Messages
  getContactMessages(): ContactMessage[] { return db.select().from(contactMessages).all(); }
  createContactMessage(message: InsertContactMessage): ContactMessage { return db.insert(contactMessages).values(message).returning().get(); }
  updateContactMessageStatus(id: number, status: string): ContactMessage | undefined {
    return db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id)).returning().get();
  }

  // Settings
  getSetting(key: string): string | undefined {
    const row = db.select().from(siteSettings).where(eq(siteSettings.key, key)).get();
    return row?.value;
  }
  setSetting(key: string, value: string): void {
    const existing = db.select().from(siteSettings).where(eq(siteSettings.key, key)).get();
    if (existing) {
      db.update(siteSettings).set({ value }).where(eq(siteSettings.key, key)).run();
    } else {
      db.insert(siteSettings).values({ key, value }).run();
    }
  }
  getAllSettings(): SiteSetting[] { return db.select().from(siteSettings).all(); }

  // IP Logs
  logIp(log: InsertIpLog): IpLog { return db.insert(ipLogs).values(log).returning().get(); }
  getIpLogs(userId?: number): IpLog[] {
    if (userId) return db.select().from(ipLogs).where(eq(ipLogs.userId, userId)).all();
    return db.select().from(ipLogs).all();
  }
  getAllIpLogs(): IpLog[] { return db.select().from(ipLogs).all(); }

  // Blocked IPs
  getBlockedIps(): BlockedIp[] { return db.select().from(blockedIps).all(); }
  blockIp(data: InsertBlockedIp): BlockedIp { return db.insert(blockedIps).values(data).returning().get(); }
  unblockIp(id: number): void { db.delete(blockedIps).where(eq(blockedIps.id, id)).run(); }
  isIpBlocked(ip: string): boolean {
    const row = db.select().from(blockedIps).where(eq(blockedIps.ip, ip)).get();
    return !!row;
  }
}

export const storage = new DatabaseStorage();
