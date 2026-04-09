import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users, MessageSquare, Shield, CheckCircle2, AlertCircle, Eye,
  Wrench, Globe, Ban, RefreshCw, Loader2, KeyRound, Mail, Trash2,
  Monitor, Wifi, UserCog, ShieldAlert, Slider,
} from "lucide-react";
import type { ContactMessage } from "@shared/schema";
import { useState } from "react";

interface IpLog {
  id: number; userId: number; ip: string; userAgent: string | null;
  action: string; timestamp: string; username?: string; fullName?: string;
}

interface BlockedIp {
  id: number; ip: string; reason: string | null; blockedBy: number; blockedAt: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Admin stats
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/stats"); return r.json(); },
  });

  // Users
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/users"); return r.json(); },
  });

  // Messages
  const { data: messages = [] } = useQuery<ContactMessage[]>({
    queryKey: ["/api/contact-messages"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/contact-messages"); return r.json(); },
  });

  // Maintenance
  const { data: maintenance } = useQuery<{ enabled: boolean; message: string; progress: number }>({
    queryKey: ["/api/maintenance/status"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/maintenance/status"); return r.json(); },
  });

  // IP Logs
  const { data: ipLogs = [] } = useQuery<IpLog[]>({
    queryKey: ["/api/admin/ip-logs"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/ip-logs"); return r.json(); },
  });

  // Blocked IPs
  const { data: blockedIps = [] } = useQuery<BlockedIp[]>({
    queryKey: ["/api/admin/blocked-ips"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/blocked-ips"); return r.json(); },
  });

  // Mutations
  const updateMsgMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await apiRequest("PATCH", `/api/contact-messages/${id}`, { status });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  const maintenanceMut = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/admin/maintenance", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
      toast({ title: "Mode maintenance mis à jour" });
    },
  });

  const updateUserMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utilisateur mis à jour" });
    },
  });

  const deleteUserMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/users/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Utilisateur supprimé" });
    },
  });

  const banUserMut = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const r = await apiRequest("POST", `/api/admin/users/${id}/ban`, { reason });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte suspendu" });
      setBanUser(null);
    },
  });

  const unbanUserMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/admin/users/${id}/unban`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte réactivé" });
    },
  });

  const blockIpMut = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/admin/blocked-ips", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "IP bloquée" });
    },
    onError: () => toast({ title: "Erreur", description: "Cette IP est déjà bloquée", variant: "destructive" }),
  });

  const unblockIpMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/blocked-ips/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "IP débloquée" });
    },
  });

  // Local state
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ password: "", email: "", fullName: "" });
  const [banUser, setBanUser] = useState<any>(null);
  const [banReason, setBanReason] = useState("");
  const [maintMsg, setMaintMsg] = useState(maintenance?.message || "");
  const [maintProgress, setMaintProgress] = useState(String(maintenance?.progress || 0));
  const [blockIpValue, setBlockIpValue] = useState("");
  const [blockIpReason, setBlockIpReason] = useState("");
  const [ipFilter, setIpFilter] = useState("");

  // Sync maintenance form when data loads
  if (maintenance && maintMsg === "" && maintenance.message) {
    setMaintMsg(maintenance.message);
    setMaintProgress(String(maintenance.progress));
  }

  const openEditUser = (u: any) => {
    setEditUser(u);
    setEditForm({ password: "", email: u.email, fullName: u.fullName });
  };

  const handleSaveUser = () => {
    if (!editUser) return;
    const data: any = {};
    if (editForm.password) data.password = editForm.password;
    if (editForm.email !== editUser.email) data.email = editForm.email;
    if (editForm.fullName !== editUser.fullName) data.fullName = editForm.fullName;
    if (Object.keys(data).length === 0) { toast({ title: "Aucune modification" }); return; }
    updateUserMut.mutate({ id: editUser.id, data });
    setEditUser(null);
  };

  const filteredIpLogs = ipFilter
    ? ipLogs.filter(l => l.username?.toLowerCase().includes(ipFilter.toLowerCase()) || l.ip.includes(ipFilter) || l.fullName?.toLowerCase().includes(ipFilter.toLowerCase()))
    : ipLogs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Panel Admin
        </h1>
        <p className="text-sm text-muted-foreground">Outils de gestion, maintenance et sécurité</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5 text-primary" />} value={stats?.totalUsers || 0} label="Utilisateurs" bg="bg-primary/10" />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-amber-500" />} value={stats?.newMessages || 0} label="Nouveaux msgs" bg="bg-amber-500/10" />
        <StatCard icon={<Globe className="w-5 h-5 text-blue-500" />} value={stats?.totalIpLogs || 0} label="Connexions IP" bg="bg-blue-500/10" />
        <StatCard icon={<Ban className="w-5 h-5 text-red-500" />} value={stats?.blockedIps || 0} label="IPs bloquées" bg="bg-red-500/10" />
      </div>

      <Tabs defaultValue="maintenance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">
            <Wrench className="w-3.5 h-3.5 mr-1" /> Maintenance
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <UserCog className="w-3.5 h-3.5 mr-1" /> Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="ip-logs" data-testid="tab-ip-logs">
            <Wifi className="w-3.5 h-3.5 mr-1" /> Historique IP
          </TabsTrigger>
          <TabsTrigger value="blocked" data-testid="tab-blocked">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> IPs Bloquées
          </TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Messages
          </TabsTrigger>
        </TabsList>

        {/* MAINTENANCE TAB */}
        <TabsContent value="maintenance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Mode Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border">
                <Switch
                  checked={maintenance?.enabled || false}
                  onCheckedChange={(v) => maintenanceMut.mutate({ enabled: v })}
                  data-testid="switch-maintenance"
                />
                <div className="flex-1">
                  <Label className="font-medium">
                    {maintenance?.enabled ? "Maintenance ACTIVÉE" : "Maintenance désactivée"}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {maintenance?.enabled
                      ? "Les utilisateurs voient la page de maintenance. Seul l'admin peut accéder au site."
                      : "Le site est accessible à tous les utilisateurs."
                    }
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${maintenance?.enabled ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Message affiché aux utilisateurs</Label>
                  <Textarea
                    value={maintMsg}
                    onChange={(e) => setMaintMsg(e.target.value)}
                    placeholder="Mise à jour en cours..."
                    rows={2}
                    data-testid="input-maint-message"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Progression ({maintProgress}%)
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={maintProgress}
                      onChange={(e) => setMaintProgress(e.target.value)}
                      className="flex-1 h-2 accent-primary"
                      data-testid="input-maint-progress"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={maintProgress}
                      onChange={(e) => setMaintProgress(e.target.value)}
                      className="w-20 h-8"
                    />
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${maintProgress}%` }} />
                  </div>
                </div>
                <Button
                  onClick={() => maintenanceMut.mutate({ message: maintMsg, progress: parseInt(maintProgress) })}
                  disabled={maintenanceMut.isPending}
                  data-testid="button-save-maint"
                >
                  Sauvegarder le message et la progression
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-medium mb-2">État du système</h3>
              <div className="space-y-1.5">
                <StatusDot label="Base de données" ok />
                <StatusDot label="API Backend" ok />
                <StatusDot label="Frontend" ok />
                <StatusDot label="Mode maintenance" ok={!maintenance?.enabled} warn={maintenance?.enabled} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserCog className="w-4 h-4" /> Gestion des utilisateurs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {users.map((u: any) => (
                  <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${u.banned ? "bg-red-500/5" : ""}`} data-testid={`admin-user-${u.id}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${u.banned ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>
                      {u.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{u.fullName}</p>
                        {u.banned === 1 && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Suspendu</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email} · @{u.username}</p>
                      {u.banned === 1 && u.banReason && (
                        <p className="text-[10px] text-red-500 truncate">Raison : {u.banReason}</p>
                      )}
                    </div>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="shrink-0">
                      {u.role === "admin" ? "Admin" : "Utilisateur"}
                    </Badge>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUser(u)} data-testid={`edit-user-${u.id}`}>
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                      {u.role !== "admin" && !u.banned && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => { setBanUser(u); setBanReason(""); }} data-testid={`ban-user-${u.id}`} title="Suspendre le compte">
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {u.role !== "admin" && u.banned === 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={() => unbanUserMut.mutate(u.id)} data-testid={`unban-user-${u.id}`} title="Réactiver le compte">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {u.role !== "admin" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(`Supprimer ${u.fullName} ?`)) deleteUserMut.mutate(u.id); }} data-testid={`delete-user-${u.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP LOGS TAB */}
        <TabsContent value="ip-logs" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Filtrer par nom, IP..."
              value={ipFilter}
              onChange={(e) => setIpFilter(e.target.value)}
              className="max-w-xs"
              data-testid="input-ip-filter"
            />
            <Badge variant="secondary">{filteredIpLogs.length} entrées</Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {filteredIpLogs.slice(0, 100).map((log) => {
                  const isBlocked = blockedIps.some(b => b.ip === log.ip);
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-sm" data-testid={`ip-log-${log.id}`}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${isBlocked ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}`}>
                        <Monitor className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs">
                          {log.fullName || "Inconnu"} <span className="text-muted-foreground font-normal">(@{log.username})</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{log.ip}</code>
                          {isBlocked && <Badge variant="destructive" className="text-[9px] px-1 py-0">Bloquée</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleString("fr-FR")}</p>
                        <p className="text-[9px] text-muted-foreground truncate max-w-[150px]">{log.userAgent?.split(" ").slice(0, 3).join(" ")}</p>
                      </div>
                      {!isBlocked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 shrink-0"
                          onClick={() => blockIpMut.mutate({ ip: log.ip, reason: `Bloqué depuis l'historique (${log.fullName})`, blockedBy: user!.id })}
                          data-testid={`block-ip-${log.id}`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {filteredIpLogs.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Aucun log IP trouvé</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BLOCKED IPS TAB */}
        <TabsContent value="blocked" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ban className="w-4 h-4" /> Bloquer une adresse IP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Adresse IP (ex: 192.168.1.1)"
                  value={blockIpValue}
                  onChange={(e) => setBlockIpValue(e.target.value)}
                  className="flex-1"
                  data-testid="input-block-ip"
                />
                <Input
                  placeholder="Raison (optionnel)"
                  value={blockIpReason}
                  onChange={(e) => setBlockIpReason(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (!blockIpValue) return;
                    blockIpMut.mutate({ ip: blockIpValue, reason: blockIpReason || null, blockedBy: user!.id });
                    setBlockIpValue("");
                    setBlockIpReason("");
                  }}
                  disabled={!blockIpValue || blockIpMut.isPending}
                  data-testid="button-block-ip"
                >
                  <Ban className="w-4 h-4 mr-1" /> Bloquer
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {blockedIps.map((ip) => (
                  <div key={ip.id} className="flex items-center gap-3 px-4 py-3" data-testid={`blocked-ip-${ip.id}`}>
                    <div className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center">
                      <Ban className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <code className="text-sm font-mono font-medium">{ip.ip}</code>
                      {ip.reason && <p className="text-xs text-muted-foreground">{ip.reason}</p>}
                      <p className="text-[10px] text-muted-foreground">Bloquée le {new Date(ip.blockedAt).toLocaleString("fr-FR")}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockIpMut.mutate(ip.id)}
                      data-testid={`unblock-ip-${ip.id}`}
                    >
                      Débloquer
                    </Button>
                  </div>
                ))}
                {blockedIps.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Aucune IP bloquée</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MESSAGES TAB */}
        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-4 space-y-2" data-testid={`message-${msg.id}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{msg.name} — {msg.subject}</p>
                        <p className="text-xs text-muted-foreground">{msg.email} · {new Date(msg.createdAt).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <Badge variant={msg.status === "new" ? "default" : msg.status === "read" ? "secondary" : "outline"}>
                        {msg.status === "new" ? "Nouveau" : msg.status === "read" ? "Lu" : "Résolu"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{msg.message}</p>
                    <div className="flex gap-2">
                      {msg.status === "new" && (
                        <Button size="sm" variant="outline" onClick={() => updateMsgMut.mutate({ id: msg.id, status: "read" })}>
                          <Eye className="w-3 h-3 mr-1" /> Marquer lu
                        </Button>
                      )}
                      {msg.status !== "resolved" && (
                        <Button size="sm" variant="outline" onClick={() => updateMsgMut.mutate({ id: msg.id, status: "resolved" })}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Résoudre
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Aucun message</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ban User Modal */}
      <Dialog open={!!banUser} onOpenChange={(v) => { if (!v) setBanUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Ban className="w-4 h-4" />
              Suspendre le compte
            </DialogTitle>
          </DialogHeader>
          {banUser && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                <p>Vous allez suspendre le compte de <span className="font-semibold">{banUser.fullName}</span> (@{banUser.username}).</p>
                <p className="text-xs text-muted-foreground mt-1">L'utilisateur ne pourra plus se connecter et verra la raison de la suspension.</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Raison de la suspension</Label>
                <Textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Non-respect du règlement, utilisation abusive..."
                  rows={3}
                  data-testid="input-ban-reason"
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => banUserMut.mutate({ id: banUser.id, reason: banReason || "Non-respect du règlement" })}
                disabled={banUserMut.isPending}
                data-testid="button-confirm-ban"
              >
                <Ban className="w-4 h-4 mr-2" /> Confirmer la suspension
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Modifier l'utilisateur
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p><span className="text-muted-foreground">ID :</span> {editUser.id}</p>
                <p><span className="text-muted-foreground">Username :</span> @{editUser.username}</p>
                <p><span className="text-muted-foreground">Rôle :</span> {editUser.role}</p>
                <p><span className="text-muted-foreground">Inscrit le :</span> {new Date(editUser.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Nom complet</Label>
                <Input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  data-testid="input-edit-fullname"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
                <Input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  data-testid="input-edit-password"
                />
              </div>
              <Button onClick={handleSaveUser} className="w-full" disabled={updateUserMut.isPending} data-testid="button-save-user">
                Sauvegarder les modifications
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, value, label, bg }: { icon: React.ReactNode; value: number; label: string; bg: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>{icon}</div>
        <div>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ label, ok, warn }: { label: string; ok?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${warn ? "bg-amber-500 animate-pulse" : ok ? "bg-emerald-500" : "bg-red-500"}`} />
      <span className="text-xs">{label} : {warn ? "Actif" : ok ? "OK" : "Erreur"}</span>
    </div>
  );
}
