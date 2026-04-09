import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

export async function registerRoutes(server: Server, app: Express) {
  // Initialize database tables
  await storage.init();

  // === MAINTENANCE STATUS ===
  app.get("/api/maintenance/status", async (req, res) => {
    const enabled = (await storage.getSetting("maintenance_enabled")) === "true";
    const message = (await storage.getSetting("maintenance_message")) || "Mise à jour en cours...";
    const progress = parseInt((await storage.getSetting("maintenance_progress")) || "0");
    res.json({ enabled, message, progress });
  });

  // === AUTH ===
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Identifiants incorrects" });
    }
    const ip = getClientIp(req);
    if ((await storage.isIpBlocked(ip)) && user.role !== "admin") {
      return res.status(403).json({ message: "Votre adresse IP a été bloquée. Contactez l'administrateur." });
    }
    await storage.logIp({
      userId: user.id, ip, userAgent: req.headers["user-agent"] || null,
      action: "login", timestamp: new Date().toISOString(),
    });
    return res.json({ id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { username, password, email, fullName } = req.body;
    if (!username || !password || !email || !fullName) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires" });
    }
    if (username.length < 3) return res.status(400).json({ message: "Nom d'utilisateur trop court (min 3 caractères)" });
    if (password.length < 6) return res.status(400).json({ message: "Mot de passe trop court (min 6 caractères)" });
    const existing = await storage.getUserByUsername(username);
    if (existing) return res.status(400).json({ message: "Nom d'utilisateur déjà pris" });
    const user = await storage.createUser({ username, password, email, fullName, role: "user", createdAt: new Date().toISOString() });
    const ip = getClientIp(req);
    await storage.logIp({
      userId: user.id, ip, userAgent: req.headers["user-agent"] || null,
      action: "login", timestamp: new Date().toISOString(),
    });
    return res.json({ id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role });
  });

  // === ACCOUNTS ===
  app.get("/api/accounts/:userId", async (req, res) => {
    res.json(await storage.getAccounts(parseInt(req.params.userId)));
  });
  app.post("/api/accounts", async (req, res) => {
    res.json(await storage.createAccount(req.body));
  });
  app.patch("/api/accounts/:id", async (req, res) => {
    const account = await storage.updateAccount(parseInt(req.params.id), req.body);
    if (!account) return res.status(404).json({ message: "Compte non trouvé" });
    res.json(account);
  });
  app.delete("/api/accounts/:id", async (req, res) => {
    await storage.deleteAccount(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // === TRANSACTIONS ===
  app.get("/api/transactions/:userId", async (req, res) => {
    const { accountId, startDate, endDate, type } = req.query;
    res.json(await storage.getTransactions(parseInt(req.params.userId), {
      accountId: accountId ? parseInt(accountId as string) : undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      type: type as string | undefined,
    }));
  });

  app.post("/api/transactions", async (req, res) => {
    const tx = await storage.createTransaction(req.body);
    if (tx.type === "transfer") {
      const src = await storage.getAccount(tx.accountId);
      if (src) await storage.updateAccount(src.id, { balance: src.balance - tx.amount });
      if (tx.toAccountId) {
        const dst = await storage.getAccount(tx.toAccountId);
        if (dst) await storage.updateAccount(dst.id, { balance: dst.balance + tx.amount });
      }
    } else {
      const account = await storage.getAccount(tx.accountId);
      if (account) {
        const bal = tx.type === "income" ? account.balance + tx.amount : account.balance - tx.amount;
        await storage.updateAccount(account.id, { balance: bal });
      }
    }
    res.json(tx);
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    const tx = await storage.updateTransaction(parseInt(req.params.id), req.body);
    if (!tx) return res.status(404).json({ message: "Transaction non trouvée" });
    res.json(tx);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    const tx = await storage.getTransaction(parseInt(req.params.id));
    if (tx) {
      if (tx.type === "transfer") {
        const src = await storage.getAccount(tx.accountId);
        if (src) await storage.updateAccount(src.id, { balance: src.balance + tx.amount });
        if (tx.toAccountId) {
          const dst = await storage.getAccount(tx.toAccountId);
          if (dst) await storage.updateAccount(dst.id, { balance: dst.balance - tx.amount });
        }
      } else {
        const account = await storage.getAccount(tx.accountId);
        if (account) {
          const bal = tx.type === "income" ? account.balance - tx.amount : account.balance + tx.amount;
          await storage.updateAccount(account.id, { balance: bal });
        }
      }
    }
    await storage.deleteTransaction(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // === SNAPSHOTS ===
  app.get("/api/snapshots/:userId", async (req, res) => {
    const { accountId } = req.query;
    res.json(await storage.getSnapshots(parseInt(req.params.userId), accountId ? parseInt(accountId as string) : undefined));
  });
  app.post("/api/snapshots", async (req, res) => { res.json(await storage.createSnapshot(req.body)); });

  // === PROJECTS ===
  app.get("/api/projects/:userId", async (req, res) => { res.json(await storage.getProjects(parseInt(req.params.userId))); });
  app.post("/api/projects", async (req, res) => { res.json(await storage.createProject(req.body)); });
  app.patch("/api/projects/:id", async (req, res) => {
    const prj = await storage.updateProject(parseInt(req.params.id), req.body);
    if (!prj) return res.status(404).json({ message: "Projet non trouvé" });
    res.json(prj);
  });
  app.delete("/api/projects/:id", async (req, res) => { await storage.deleteProject(parseInt(req.params.id)); res.json({ ok: true }); });

  // === SHARED REPORTS ===
  app.get("/api/shared-reports/:userId", async (req, res) => { res.json(await storage.getSharedReports(parseInt(req.params.userId))); });
  app.post("/api/shared-reports", async (req, res) => {
    res.json(await storage.createSharedReport({ ...req.body, sentAt: new Date().toISOString() }));
  });

  // === CONTACT MESSAGES ===
  app.get("/api/contact-messages", async (req, res) => { res.json(await storage.getContactMessages()); });
  app.post("/api/contact-messages", async (req, res) => {
    const msg = await storage.createContactMessage({ ...req.body, createdAt: new Date().toISOString() });
    res.json(msg);
  });
  app.patch("/api/contact-messages/:id", async (req, res) => {
    const msg = await storage.updateContactMessageStatus(parseInt(req.params.id), req.body.status);
    if (!msg) return res.status(404).json({ message: "Message non trouvé" });
    res.json(msg);
  });

  // === ADMIN ===
  app.get("/api/admin/users", async (req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({ ...u, password: "***" })));
  });

  app.get("/api/admin/stats", async (req, res) => {
    const allUsers = await storage.getAllUsers();
    const msgs = await storage.getContactMessages();
    const blockedCount = (await storage.getBlockedIps()).length;
    const ipLogsCount = (await storage.getAllIpLogs()).length;
    res.json({
      totalUsers: allUsers.length,
      newMessages: msgs.filter(m => m.status === "new").length,
      totalMessages: msgs.length,
      blockedIps: blockedCount,
      totalIpLogs: ipLogsCount,
    });
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    const { password, email, fullName, role } = req.body;
    const data: any = {};
    if (password) data.password = password;
    if (email) data.email = email;
    if (fullName) data.fullName = fullName;
    if (role) data.role = role;
    const user = await storage.updateUser(parseInt(req.params.id), data);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json({ ...user, password: "***" });
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    await storage.deleteUser(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/admin/users/:id/details", async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.id));
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    const accs = await storage.getAccounts(user.id);
    const txs = await storage.getTransactions(user.id);
    const ips = await storage.getIpLogs(user.id);
    res.json({ user: { ...user, password: "***" }, accountsCount: accs.length, transactionsCount: txs.length, ipLogs: ips });
  });

  // === MAINTENANCE ===
  app.post("/api/admin/maintenance", async (req, res) => {
    const { enabled, message, progress } = req.body;
    if (typeof enabled === "boolean") await storage.setSetting("maintenance_enabled", String(enabled));
    if (message !== undefined) await storage.setSetting("maintenance_message", message);
    if (progress !== undefined) await storage.setSetting("maintenance_progress", String(progress));
    res.json({
      enabled: (await storage.getSetting("maintenance_enabled")) === "true",
      message: await storage.getSetting("maintenance_message"),
      progress: parseInt((await storage.getSetting("maintenance_progress")) || "0"),
    });
  });

  // === IP LOGS ===
  app.get("/api/admin/ip-logs", async (req, res) => {
    const { userId } = req.query;
    const logs = userId ? await storage.getIpLogs(parseInt(userId as string)) : await storage.getAllIpLogs();
    const allUsers = await storage.getAllUsers();
    const enriched = logs.map(log => {
      const u = allUsers.find(u => u.id === log.userId);
      return { ...log, username: u?.username, fullName: u?.fullName };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    res.json(enriched);
  });

  // === BLOCKED IPS ===
  app.get("/api/admin/blocked-ips", async (req, res) => {
    res.json(await storage.getBlockedIps());
  });
  app.post("/api/admin/blocked-ips", async (req, res) => {
    const { ip, reason, blockedBy } = req.body;
    try {
      const blocked = await storage.blockIp({ ip, reason: reason || null, blockedBy, blockedAt: new Date().toISOString() });
      res.json(blocked);
    } catch {
      res.status(400).json({ message: "Cette IP est déjà bloquée" });
    }
  });
  app.delete("/api/admin/blocked-ips/:id", async (req, res) => {
    await storage.unblockIp(parseInt(req.params.id));
    res.json({ ok: true });
  });
}
