import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  // Login form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Register form
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regFullName, setRegFullName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const user = await res.json();
      login(user);
      toast({ title: "Bienvenue", description: `Connecté en tant que ${user.fullName}` });
    } catch (err: any) {
      const msg = err?.message || "Identifiants incorrects";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    if (regPassword.length < 6) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        username: regUsername, password: regPassword, email: regEmail, fullName: regFullName,
      });
      const user = await res.json();
      login(user);
      toast({ title: "Compte créé", description: `Bienvenue ${user.fullName}` });
    } catch (err: any) {
      const msg = err?.message || "Erreur lors de la création du compte";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-label="KatenaDEP Logo">
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
          </div>
          <CardTitle className="text-xl font-bold">KatenaDEP</CardTitle>
          <p className="text-sm text-muted-foreground">Gestion de vos finances personnelles</p>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  data-testid="input-username"
                  placeholder="Nom d'utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <Input
                  data-testid="input-password"
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button data-testid="button-login" type="submit" className="w-full" disabled={loading}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Connexion
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  onClick={() => setMode("register")}
                  className="text-sm text-primary hover:underline"
                  data-testid="link-register"
                >
                  Pas encore de compte ? Créer un compte
                </button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  data-testid="input-reg-fullname"
                  placeholder="Nom complet"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  required
                />
                <Input
                  data-testid="input-reg-email"
                  type="email"
                  placeholder="Adresse email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
                <Input
                  data-testid="input-reg-username"
                  placeholder="Nom d'utilisateur (min 3 caractères)"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  required
                  minLength={3}
                />
                <Input
                  data-testid="input-reg-password"
                  type="password"
                  placeholder="Mot de passe (min 6 caractères)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Input
                  data-testid="input-reg-confirm"
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  required
                />
                <Button data-testid="button-register" type="submit" className="w-full" disabled={loading}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Créer mon compte
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  onClick={() => setMode("login")}
                  className="text-sm text-primary hover:underline"
                  data-testid="link-login"
                >
                  Déjà un compte ? Se connecter
                </button>
              </div>
            </>
          )}


        </CardContent>
      </Card>
    </div>
  );
}
