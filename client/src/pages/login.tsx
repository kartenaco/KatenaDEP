import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import logoImg from "@assets/logo.jpg";

function PasswordInput({ value, onChange, placeholder, testId, ...props }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string; testId: string; [key: string]: any;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        data-testid={testId}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="pr-10"
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        data-testid={`${testId}-toggle`}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
          <img src={logoImg} alt="KatenaDEP" className="w-20 h-20 rounded-2xl mx-auto" />
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
                <PasswordInput
                  testId="input-password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e: any) => setPassword(e.target.value)}
                  required
                />
                <Button data-testid="button-login" type="submit" className="w-full" disabled={loading}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Connexion
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button onClick={() => setMode("register")} className="text-sm text-primary hover:underline" data-testid="link-register">
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
                <PasswordInput
                  testId="input-reg-password"
                  placeholder="Mot de passe (min 6 caractères)"
                  value={regPassword}
                  onChange={(e: any) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <PasswordInput
                  testId="input-reg-confirm"
                  placeholder="Confirmer le mot de passe"
                  value={regConfirm}
                  onChange={(e: any) => setRegConfirm(e.target.value)}
                  required
                />
                <Button data-testid="button-register" type="submit" className="w-full" disabled={loading}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Créer mon compte
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button onClick={() => setMode("login")} className="text-sm text-primary hover:underline" data-testid="link-login">
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
