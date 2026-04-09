import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

export async function registerRoutes(server: Server, app: Express) {

  // === MAINTENANCE CHECK MIDDLEWARE ===
  app.get("/api/maintenance/status", (req, res) => {
    const enabled = storage.getSetting("maintenance_enabled") === "true";
    const message = storage.getSetting("maintenance_message") || "Mise à jour en cours...";
    const progress = parseInt(storage.getSetting("maintenance_progress") || "0");
    res.json({ enabled, message, progress });
  });

  // === AUTH ===
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Identifiants incorrects" });
    }
    // Check IP block
    const ip = getClientIp(req);
    if (storage.isIpBlocked(ip) && user.role !== "admin") {
      return res.status(403).json({ message: "Votre adresse IP a été bloquée. Contactez l'administrateur." });
    }
    // Log IP
    storage.logIp({
      userId: user.id, ip, userAgent: req.headers["user-agent"] || null,
      action: "login", timestamp: new Date().toISOString(),
    });
    return res.json({ id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role });
  });

  app.post("/api/auth/register", (req, res) => {
    const { username, password, email, fullName } = req.body;
    if (!username || !password || !email || !fullName) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires" });
    }
    if (username.length < 3) return res.status(400).json({ message: "Nom d'utilisateur trop court (min 3 caractères)" });
    if (password.length < 6) return res.status(400).json({ message: "Mot de passe trop court (min 6 caractères)" });
    const existing = storage.getUserByUsername(username);
    if (existing) return res.status(400).json({ message: "Nom d'utilisateur déjà pris" });
    const user = storage.createUser({ username, password, email, fullName, role: "user", createdAt: new Date().toISOString() });
    // Log IP
    const ip = getClientIp(req);
    storage.logIp({
      userId: user.id, ip, userAgent: req.headers["user-agent"] || null,
      action: "login", timestamp: new Date().toISOString(),
    });
    return res.json({ id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role });
  });

  // === ACCOUNTS ===
  app.get("/api/accounts/:userId", (req, res) => {
    res.json(storage.getAccounts(parseInt(req.params.userId)));
  });

  app.post("/api/accounts", (req, res) => {
    res.json(storage.createAccount(req.body));
  });

  app.patch("/api/accounts/:id", (req, res) => {
    const account = storage.updateAccount(parseInt(req.params.id), req.body);
    if (!account) return res.status(404).json({ message: "Compte non trouvé" });
    res.json(account);
  });

  app.delete("/api/accounts/:id", (req, res) => {
    storage.deleteAccount(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // === TRANSACTIONS ===
  app.get("/api/transactions/:userId", (req, res) => {
    const { accountId, startDate, endDate, type } = req.query;
    res.json(storage.getTransactions(parseInt(req.params.userId), {
      accountId: accountId ? parseInt(accountId as string) : undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      type: type as string | undefined,
    }));
  });

  app.post("/api/transactions", (req, res) => {
    const tx = storage.createTransaction(req.body);
    if (tx.type === "transfer") {
      const src = storage.getAccount(tx.accountId);
      if (src) storage.updateAccount(src.id, { balance: src.balance - tx.amount });
      if (tx.toAccountId) {
        const dst = storage.getAccount(tx.toAccountId);
        if (dst) storage.updateAccount(dst.id, { balance: dst.balance + tx.amount });
      }
    } else {
      const account = storage.getAccount(tx.accountId);
      if (account) {
        const bal = tx.type === "income" ? account.balance + tx.amount : account.balance - tx.amount;
        storage.updateAccount(account.id, { balance: bal });
      }
    }
    res.json(tx);
  });

  app.patch("/api/transactions/:id", (req, res) => {
    const tx = storage.updateTransaction(parseInt(req.params.id), req.body);
    if (!tx) return res.status(404).json({ message: "Transaction non trouvée" });
    res.json(tx);
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const tx = storage.getTransaction(parseInt(req.params.id));
    if (tx) {
      if (tx.type === "transfer") {
        const src = storage.getAccount(tx.accountId);
        if (src) storage.updateAccount(src.id, { balance: src.balance + tx.amount });
        if (tx.toAccountId) {
          const dst = storage.getAccount(tx.toAccountId);
          if (dst) storage.updateAccount(dst.id, { balance: dst.balance - tx.amount });
        }
      } else {
        const account = storage.getAccount(tx.accountId);
        if (account) {
          const bal = tx.type === "income" ? account.balance - tx.amount : account.balance + tx.amount;
          storage.updateAccount(account.id, { balance: bal });
        }
      }
    }
    storage.deleteTransaction(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // === SNAPSHOTS ===
  app.get("/api/snapshots/:userId", (req, res) => {
    const { accountId } = req.query;
    res.json(storage.getSnapshots(parseInt(req.params.userId), accountId ? parseInt(accountId as string) : undefined));
  });
  app.post("/api/snapshots", (req, res) => { res.json(storage.createSnapshot(req.body)); });

  // === PROJECTS ===
  app.get("/api/projects/:userId", (req, res) => { res.json(storage.getProjects(parseInt(req.params.userId))); });
  app.post("/api/projects", (req, res) => { res.json(storage.createProject(req.body)); });
  app.patch("/api/projects/:id", (req, res) => {
    const prj = storage.updateProject(parseInt(req.params.id), req.body);
    if (!prj) return res.status(404).json({ message: "Projet non trouvé" });
    res.json(prj);
  });
  app.delete("/api/projects/:id", (req, res) => { storage.deleteProject(parseInt(req.params.id)); res.json({ ok: true }); });

  // === SHARED REPORTS ===
  app.get("/api/shared-reports/:userId", (req, res) => { res.json(storage.getSharedReports(parseInt(req.params.userId))); });
  app.post("/api/shared-reports", (req, res) => {
    res.json(storage.createSharedReport({ ...req.body, sentAt: new Date().toISOString() }));
  });

  // === CONTACT MESSAGES ===
  app.get("/api/contact-messages", (req, res) => { res.json(storage.getContactMessages()); });
  app.post("/api/contact-messages", (req, res) => {
    const msg = storage.createContactMessage({ ...req.body, createdAt: new Date().toISOString() });
    // Note: Real email sending requires SMTP config (nodemailer + Gmail app password)
    // Messages are saved and visible in the admin panel
    res.json(msg);
  });
  app.patch("/api/contact-messages/:id", (req, res) => {
    const msg = storage.updateContactMessageStatus(parseInt(req.params.id), req.body.status);
    if (!msg) return res.status(404).json({ message: "Message non trouvé" });
    res.json(msg);
  });

  // === ADMIN ===
  app.get("/api/admin/users", (req, res) => {
    const allUsers = storage.getAllUsers();
    res.json(allUsers.map(u => ({ ...u, password: "***" })));
  });

  app.get("/api/admin/stats", (req, res) => {
    const allUsers = storage.getAllUsers();
    const msgs = storage.getContactMessages();
    const blockedCount = storage.getBlockedIps().length;
    const ipLogsCount = storage.getAllIpLogs().length;
    res.json({
      totalUsers: allUsers.length,
      newMessages: msgs.filter(m => m.status === "new").length,
      totalMessages: msgs.length,
      blockedIps: blockedCount,
      totalIpLogs: ipLogsCount,
    });
  });

  // Admin: update user (password reset, email change, etc.)
  app.patch("/api/admin/users/:id", (req, res) => {
    const { password, email, fullName, role } = req.body;
    const data: any = {};
    if (password) data.password = password;
    if (email) data.email = email;
    if (fullName) data.fullName = fullName;
    if (role) data.role = role;
    const user = storage.updateUser(parseInt(req.params.id), data);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json({ ...user, password: "***" });
  });

  // Admin: delete user
  app.delete("/api/admin/users/:id", (req, res) => {
    storage.deleteUser(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Admin: get user with full details (including password for recovery)
  app.get("/api/admin/users/:id/details", (req, res) => {
    const user = storage.getUser(parseInt(req.params.id));
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    const accs = storage.getAccounts(user.id);
    const txCount = storage.getTransactions(user.id).length;
    const ips = storage.getIpLogs(user.id);
    res.json({ user: { ...user, password: "***" }, accountsCount: accs.length, transactionsCount: txCount, ipLogs: ips });
  });

  // === MAINTENANCE ===
  app.post("/api/admin/maintenance", (req, res) => {
    const { enabled, message, progress } = req.body;
    if (typeof enabled === "boolean") storage.setSetting("maintenance_enabled", String(enabled));
    if (message !== undefined) storage.setSetting("maintenance_message", message);
    if (progress !== undefined) storage.setSetting("maintenance_progress", String(progress));
    res.json({
      enabled: storage.getSetting("maintenance_enabled") === "true",
      message: storage.getSetting("maintenance_message"),
      progress: parseInt(storage.getSetting("maintenance_progress") || "0"),
    });
  });

  // === IP LOGS ===
  app.get("/api/admin/ip-logs", (req, res) => {
    const { userId } = req.query;
    const logs = userId ? storage.getIpLogs(parseInt(userId as string)) : storage.getAllIpLogs();
    // Enrich with user data
    const allUsers = storage.getAllUsers();
    const enriched = logs.map(log => {
      const u = allUsers.find(u => u.id === log.userId);
      return { ...log, username: u?.username, fullName: u?.fullName };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    res.json(enriched);
  });

  // === BLOCKED IPS ===
  app.get("/api/admin/blocked-ips", (req, res) => {
    res.json(storage.getBlockedIps());
  });

  app.post("/api/admin/blocked-ips", (req, res) => {
    const { ip, reason, blockedBy } = req.body;
    try {
      const blocked = storage.blockIp({ ip, reason: reason || null, blockedBy, blockedAt: new Date().toISOString() });
      res.json(blocked);
    } catch {
      res.status(400).json({ message: "Cette IP est déjà bloquée" });
    }
  });

  app.delete("/api/admin/blocked-ips/:id", (req, res) => {
    storage.unblockIp(parseInt(req.params.id));
    res.json({ ok: true });
  });
}
