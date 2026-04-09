import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Pencil, Landmark, PiggyBank, TrendingUp, CreditCard, Wallet,
  ArrowUpRight, ArrowDownRight, CirclePlus, ArrowRightLeft,
} from "lucide-react";
import type { Account } from "@shared/schema";
import { useState } from "react";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Compte Courant", icon: Landmark },
  { value: "savings", label: "Épargne", icon: PiggyBank },
  { value: "livret", label: "Livret", icon: Wallet },
  { value: "etf", label: "ETF / Investissement", icon: TrendingUp },
  { value: "crypto", label: "Crypto", icon: CreditCard },
];

const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#84CC16"];

const CATEGORIES = {
  income: ["Salaire", "Freelance", "Dividendes", "Remboursement", "Vente", "Virement reçu", "Autre"],
  expense: ["Loyer", "Courses", "Transport", "Abonnements", "Restaurants", "Loisirs", "Santé", "Shopping", "Factures", "Virement envoyé", "Autre"],
  transfer: ["Transfert"],
};

export default function AccountsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Account form
  const [accountOpen, setAccountOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [accountForm, setAccountForm] = useState({ name: "", type: "checking", bankName: "", balance: "0", color: "#3B82F6" });

  // Transaction form
  const [txOpen, setTxOpen] = useState(false);
  const [txAccount, setTxAccount] = useState<Account | null>(null);
  const [txForm, setTxForm] = useState({
    type: "income" as "income" | "expense" | "transfer",
    category: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    isRecurring: false,
    recurringFrequency: "monthly",
    toAccountId: "",
  });

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/accounts/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  // Account mutations
  const createAccountMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", user?.id] });
      toast({ title: "Compte ajouté" });
      resetAccountForm();
    },
  });

  const updateAccountMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/accounts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", user?.id] });
      toast({ title: "Compte modifié" });
      resetAccountForm();
    },
  });

  const deleteAccountMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", user?.id] });
      toast({ title: "Compte supprimé" });
    },
  });

  // Transaction mutation
  const createTxMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", user?.id] });
      toast({ title: "Transaction enregistrée", description: "Le solde du compte a été mis à jour." });
      closeTxModal();
    },
  });

  const resetAccountForm = () => {
    setAccountForm({ name: "", type: "checking", bankName: "", balance: "0", color: "#3B82F6" });
    setEditId(null);
    setAccountOpen(false);
  };

  const openTxModal = (account: Account) => {
    setTxAccount(account);
    setTxForm({
      type: "income",
      category: "",
      description: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      isRecurring: false,
      recurringFrequency: "monthly",
      toAccountId: "",
    });
    setTxOpen(true);
  };

  const closeTxModal = () => {
    setTxOpen(false);
    setTxAccount(null);
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...accountForm, balance: parseFloat(accountForm.balance), userId: user!.id };
    if (editId) {
      updateAccountMut.mutate({ id: editId, data });
    } else {
      createAccountMut.mutate(data);
    }
  };

  const startEditAccount = (acc: Account) => {
    setAccountForm({ name: acc.name, type: acc.type, bankName: acc.bankName, balance: String(acc.balance), color: acc.color });
    setEditId(acc.id);
    setAccountOpen(true);
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAccount) return;
    const payload: any = {
      userId: user!.id,
      accountId: txAccount.id,
      type: txForm.type,
      category: txForm.type === "transfer" ? "Transfert" : txForm.category,
      description: txForm.description || null,
      amount: parseFloat(txForm.amount),
      date: txForm.date,
      isRecurring: txForm.isRecurring ? 1 : 0,
      recurringFrequency: txForm.isRecurring ? txForm.recurringFrequency : null,
      toAccountId: txForm.type === "transfer" && txForm.toAccountId ? parseInt(txForm.toAccountId) : null,
    };
    createTxMut.mutate(payload);
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  // Available destination accounts for transfer (exclude source)
  const transferDestinations = txAccount ? accounts.filter(a => a.id !== txAccount.id) : [];

  // For transfer preview
  const destAccount = txForm.toAccountId ? accounts.find(a => a.id === parseInt(txForm.toAccountId)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Comptes & Investissements</h1>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{totalBalance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </p>
        </div>
        <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account" size="sm" onClick={() => { resetAccountForm(); setAccountOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter un compte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Modifier le compte" : "Nouveau compte"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <Input
                data-testid="input-account-name"
                placeholder="Nom du compte"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                required
              />
              <Input
                data-testid="input-bank-name"
                placeholder="Nom de la banque"
                value={accountForm.bankName}
                onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                required
              />
              <Select value={accountForm.type} onValueChange={(v) => setAccountForm({ ...accountForm, type: v })}>
                <SelectTrigger data-testid="select-account-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editId && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Solde initial</Label>
                  <Input
                    data-testid="input-balance"
                    type="number"
                    step="0.01"
                    placeholder="Solde initial"
                    value={accountForm.balance}
                    onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
                  />
                </div>
              )}
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-all ${accountForm.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setAccountForm({ ...accountForm, color: c })}
                  />
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={createAccountMut.isPending || updateAccountMut.isPending}>
                {editId ? "Modifier" : "Créer le compte"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const TypeIcon = ACCOUNT_TYPES.find((t) => t.value === acc.type)?.icon || Wallet;
          return (
            <Card key={acc.id} data-testid={`account-${acc.id}`} className="group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: acc.color }}
                    >
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditAccount(acc)} data-testid={`edit-account-${acc.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAccountMut.mutate(acc.id)} data-testid={`delete-account-${acc.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-xl font-bold tabular-nums mb-1">
                  {acc.balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </p>
                <p className="text-xs text-muted-foreground mb-4 capitalize">
                  {ACCOUNT_TYPES.find((t) => t.value === acc.type)?.label}
                </p>

                {/* Quick transaction button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openTxModal(acc)}
                  data-testid={`add-tx-${acc.id}`}
                >
                  <CirclePlus className="w-4 h-4 mr-2" />
                  Ajouter une opération
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transaction Modal */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txAccount && (
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: txAccount.color }}
                >
                  {txAccount.name.charAt(0)}
                </div>
              )}
              Nouvelle opération
              {txAccount && (
                <Badge variant="secondary" className="text-xs ml-auto font-normal">
                  {txAccount.name}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleTxSubmit} className="space-y-4">
            {/* Type selector - 3 buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={txForm.type === "income" ? "default" : "outline"}
                className={txForm.type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                onClick={() => setTxForm({ ...txForm, type: "income", category: "", toAccountId: "" })}
                data-testid="tx-type-income"
                size="sm"
              >
                <ArrowUpRight className="w-4 h-4 mr-1" /> Revenu
              </Button>
              <Button
                type="button"
                variant={txForm.type === "expense" ? "default" : "outline"}
                className={txForm.type === "expense" ? "bg-red-600 hover:bg-red-700" : ""}
                onClick={() => setTxForm({ ...txForm, type: "expense", category: "", toAccountId: "" })}
                data-testid="tx-type-expense"
                size="sm"
              >
                <ArrowDownRight className="w-4 h-4 mr-1" /> Dépense
              </Button>
              <Button
                type="button"
                variant={txForm.type === "transfer" ? "default" : "outline"}
                className={txForm.type === "transfer" ? "bg-blue-600 hover:bg-blue-700" : ""}
                onClick={() => setTxForm({ ...txForm, type: "transfer", category: "Transfert", toAccountId: "" })}
                data-testid="tx-type-transfer"
                size="sm"
              >
                <ArrowRightLeft className="w-4 h-4 mr-1" /> Transfert
              </Button>
            </div>

            {/* Transfer destination */}
            {txForm.type === "transfer" && (
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <Label className="text-xs text-muted-foreground mb-2 block">Transférer vers</Label>
                <Select value={txForm.toAccountId} onValueChange={(v) => setTxForm({ ...txForm, toAccountId: v })}>
                  <SelectTrigger data-testid="tx-to-account">
                    <SelectValue placeholder="Sélectionner le compte de destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferDestinations.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.bankName} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {txAccount && txForm.toAccountId && destAccount && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium flex items-center gap-1">
                    {txAccount.bankName} — {txAccount.name}
                    <ArrowRightLeft className="w-3 h-3 mx-1" />
                    {destAccount.bankName} — {destAccount.name}
                  </p>
                )}
              </div>
            )}

            {/* Amount - big and prominent */}
            <div className="relative">
              <Input
                data-testid="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="text-center text-xl font-bold h-14 pr-8"
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">€</span>
            </div>

            {/* Category - only for income/expense */}
            {txForm.type !== "transfer" && (
              <Select value={txForm.category} onValueChange={(v) => setTxForm({ ...txForm, category: v })}>
                <SelectTrigger data-testid="tx-category"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES[txForm.type].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Description - optional */}
            <Input
              data-testid="tx-description"
              placeholder="Description (optionnel)"
              value={txForm.description}
              onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
            />

            {/* Date */}
            <Input
              data-testid="tx-date"
              type="date"
              value={txForm.date}
              onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
            />

            {/* Recurring */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Switch
                checked={txForm.isRecurring}
                onCheckedChange={(v) => setTxForm({ ...txForm, isRecurring: v })}
                data-testid="tx-recurring"
              />
              <Label className="text-sm flex-1">Opération récurrente</Label>
              {txForm.isRecurring && (
                <Select value={txForm.recurringFrequency} onValueChange={(v) => setTxForm({ ...txForm, recurringFrequency: v })}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Hebdo</SelectItem>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                    <SelectItem value="yearly">Annuel</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Preview */}
            {txForm.amount && txAccount && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                {txForm.type === "transfer" ? (
                  <>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">{txAccount.bankName} — {txAccount.name}</span>
                      <span className="tabular-nums">{txAccount.balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className="flex justify-between text-red-500 font-medium">
                      <span>- Transfert sortant</span>
                      <span className="tabular-nums">-{parseFloat(txForm.amount || "0").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                      <span>Nouveau solde</span>
                      <span className="tabular-nums">
                        {(txAccount.balance - parseFloat(txForm.amount || "0")).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                      </span>
                    </div>
                    {destAccount && (
                      <>
                        <div className="border-t mt-2 pt-2 flex justify-between mb-1">
                          <span className="text-muted-foreground">{destAccount.bankName} — {destAccount.name}</span>
                          <span className="tabular-nums">{destAccount.balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="flex justify-between text-emerald-500 font-medium">
                          <span>+ Transfert entrant</span>
                          <span className="tabular-nums">+{parseFloat(txForm.amount || "0").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                          <span>Nouveau solde</span>
                          <span className="tabular-nums">
                            {(destAccount.balance + parseFloat(txForm.amount || "0")).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                        <div className="border-t mt-3 pt-2 flex justify-between text-blue-600 dark:text-blue-400 font-semibold text-xs">
                          <span>Total global inchangé</span>
                          <span>0,00 €</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Solde actuel</span>
                      <span className="tabular-nums">{txAccount.balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className={`flex justify-between font-medium ${txForm.type === "income" ? "text-emerald-500" : "text-red-500"}`}>
                      <span>{txForm.type === "income" ? "+" : "-"} Opération</span>
                      <span className="tabular-nums">{txForm.type === "income" ? "+" : "-"}{parseFloat(txForm.amount || "0").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                      <span>Nouveau solde</span>
                      <span className="tabular-nums">
                        {(txForm.type === "income"
                          ? txAccount.balance + parseFloat(txForm.amount || "0")
                          : txAccount.balance - parseFloat(txForm.amount || "0")
                        ).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={createTxMut.isPending || (txForm.type === "transfer" && !txForm.toAccountId)}
              data-testid="tx-submit"
            >
              {createTxMut.isPending ? "Enregistrement..." : txForm.type === "transfer" ? "Effectuer le transfert" : "Enregistrer l'opération"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
