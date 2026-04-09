import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AccountsPage from "@/pages/accounts";
import TransactionsPage from "@/pages/transactions";
import ProjectsPage from "@/pages/projects";
import SharePage from "@/pages/share";
import ContactPage from "@/pages/contact";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

import {
  LayoutDashboard, Wallet, ArrowLeftRight, FolderKanban, Share2,
  MessageSquare, Shield, Sun, Moon, LogOut, ChevronLeft, Menu, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Maintenance page shown to non-admin users
function MaintenancePage({ message, progress, userName, onLogout }: { message: string; progress: number; userName?: string; onLogout?: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center max-w-md space-y-6">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto" aria-label="KatenaDEP Logo">
          <rect width="64" height="64" rx="14" fill="hsl(210, 90%, 50%)" />
          <g transform="translate(12, 8)">
            <ellipse cx="20" cy="24" rx="18" ry="16" fill="hsl(40, 85%, 55%)" />
            <ellipse cx="20" cy="24" rx="18" ry="16" fill="hsl(35, 80%, 48%)" opacity="0.4" />
            <ellipse cx="20" cy="26" rx="13" ry="12" fill="hsl(40, 80%, 60%)" />
            <ellipse cx="14" cy="23" rx="2.5" ry="2.5" fill="white" />
            <ellipse cx="26" cy="23" rx="2.5" ry="2.5" fill="white" />
            <circle cx="14.5" cy="23" r="1.5" fill="#1a1a2e" />
            <circle cx="26.5" cy="23" r="1.5" fill="#1a1a2e" />
            <ellipse cx="20" cy="29" rx="3" ry="2" fill="hsl(20, 40%, 35%)" />
            <path d="M17 31 Q20 34 23 31" stroke="hsl(20, 40%, 35%)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </g>
        </svg>
        <h1 className="text-2xl font-bold">KatenaDEP</h1>
        <div className="space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground font-medium">{message}</p>
          {progress > 0 && (
            <div className="space-y-2">
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">{progress}%</p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Veuillez patienter, le service sera de retour très bientôt.</p>
        {userName && onLogout && (
          <div className="pt-4 border-t space-y-2">
            <p className="text-sm text-muted-foreground">Connecté en tant que <span className="font-medium text-foreground">{userName}</span></p>
            <Button variant="outline" size="sm" onClick={onLogout} data-testid="button-maint-logout">
              <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const { user, logout, isAdmin } = useAuth();

  // Check maintenance status
  const { data: maintenance } = useQuery<{ enabled: boolean; message: string; progress: number }>({
    queryKey: ["/api/maintenance/status"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/maintenance/status"); return r.json(); },
    refetchInterval: 10000, // Check every 10s
  });

  // Not logged in: always show login page (even during maintenance)
  if (!user) {
    return <LoginPage />;
  }

  // Logged in but maintenance is active and user is NOT admin:
  // show maintenance page with their name + logout button
  if (maintenance?.enabled && !isAdmin) {
    return (
      <MaintenancePage
        message={maintenance.message}
        progress={maintenance.progress}
        userName={user.fullName}
        onLogout={logout}
      />
    );
  }

  return <AppLayout isAdmin={isAdmin} onLogout={logout} userName={user.fullName} />;
}

// User nav items (regular users)
const USER_NAV = [
  { path: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { path: "/accounts", label: "Comptes", icon: Wallet },
  { path: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { path: "/projects", label: "Projets", icon: FolderKanban },
  { path: "/share", label: "Partage", icon: Share2 },
  { path: "/contact", label: "Contact & RGPD", icon: MessageSquare },
];

// Admin nav items (admin only sees admin panel + projects)
const ADMIN_NAV = [
  { path: "/admin", label: "Panel Admin", icon: Shield },
  { path: "/projects", label: "Projets", icon: FolderKanban },
];

function AppLayout({ isAdmin, onLogout, userName }: { isAdmin: boolean; onLogout: () => void; userName: string }) {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static z-40 h-full flex flex-col
          bg-sidebar text-sidebar-foreground border-r border-sidebar-border
          transition-all duration-200 ease-out
          ${collapsed ? "w-16" : "w-56"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className={`flex items-center gap-2 px-4 h-14 border-b border-sidebar-border ${collapsed ? "justify-center" : ""}`}>
          <svg width="30" height="30" viewBox="0 0 64 64" fill="none" aria-label="KatenaDEP Logo">
            <rect width="64" height="64" rx="14" fill="hsl(210, 90%, 50%)" />
            <g transform="translate(12, 8)">
              <ellipse cx="20" cy="24" rx="18" ry="16" fill="hsl(40, 85%, 55%)" />
              <ellipse cx="20" cy="24" rx="18" ry="16" fill="hsl(35, 80%, 48%)" opacity="0.4" />
              <path d="M6 12 L2 6 L10 10Z" fill="hsl(35, 75%, 45%)" />
              <path d="M14 7 L12 0 L18 6Z" fill="hsl(35, 75%, 45%)" />
              <path d="M24 5 L26 -1 L28 6Z" fill="hsl(35, 75%, 45%)" />
              <path d="M33 9 L38 4 L34 12Z" fill="hsl(35, 75%, 45%)" />
              <path d="M36 16 L42 14 L37 20Z" fill="hsl(35, 75%, 45%)" />
              <path d="M4 20 L-2 18 L4 24Z" fill="hsl(35, 75%, 45%)" />
              <ellipse cx="20" cy="26" rx="13" ry="12" fill="hsl(40, 80%, 60%)" />
              <ellipse cx="14" cy="23" rx="2.5" ry="2.5" fill="white" />
              <ellipse cx="26" cy="23" rx="2.5" ry="2.5" fill="white" />
              <circle cx="14.5" cy="23" r="1.5" fill="#1a1a2e" />
              <circle cx="26.5" cy="23" r="1.5" fill="#1a1a2e" />
              <ellipse cx="20" cy="29" rx="3" ry="2" fill="hsl(20, 40%, 35%)" />
              <path d="M17 31 Q20 34 23 31" stroke="hsl(20, 40%, 35%)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <ellipse cx="7" cy="16" rx="4" ry="5" fill="hsl(40, 80%, 55%)" />
              <ellipse cx="7" cy="16" rx="2.5" ry="3" fill="hsl(350, 50%, 65%)" />
              <ellipse cx="33" cy="16" rx="4" ry="5" fill="hsl(40, 80%, 55%)" />
              <ellipse cx="33" cy="16" rx="2.5" ry="3" fill="hsl(350, 50%, 65%)" />
            </g>
          </svg>
          {!collapsed && <span className="font-bold text-sm">KatenaDEP</span>}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.path || (item.path === "/admin" && location === "/");
            return (
              <Link key={item.path} href={item.path}>
                <button
                  onClick={() => setMobileOpen(false)}
                  data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }
                    ${collapsed ? "justify-center px-0" : ""}
                  `}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
            data-testid="button-theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {!collapsed && <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
            data-testid="button-collapse"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span>Réduire</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} data-testid="button-mobile-menu">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm">KatenaDEP</span>
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Switch>
            {isAdmin ? (
              <>
                <Route path="/" component={AdminPage} />
                <Route path="/admin" component={AdminPage} />
                <Route path="/projects" component={ProjectsPage} />
              </>
            ) : (
              <>
                <Route path="/" component={DashboardPage} />
                <Route path="/accounts" component={AccountsPage} />
                <Route path="/transactions" component={TransactionsPage} />
                <Route path="/projects" component={ProjectsPage} />
                <Route path="/share" component={SharePage} />
                <Route path="/contact" component={ContactPage} />
              </>
            )}
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router hook={useHashLocation}>
            <AppContent />
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
