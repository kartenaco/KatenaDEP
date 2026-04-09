import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Search } from "lucide-react";
import type { Transaction, Account } from "@shared/schema";
import { useState, useMemo } from "react";

const CATEGORIES = {
  income: ["Salaire", "Freelance", "Dividendes", "Remboursement", "Vente", "Autre"],
  expense: ["Loyer", "Courses", "Transport", "Abonnements", "Restaurants", "Loisirs", "Santé", "Shopping", "Factures", "Autre"],
  transfer: ["Transfert"],
};

export default function TransactionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    type: "expense" as "income" | "expense" | "transfer",
    accountId: "",
    toAccountId: "",
    category: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    isRecurring: false,
    recurringFrequency: "monthly",
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/accounts/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/transactions/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", user?.id] });
      toast({ title: "Transaction ajoutée" });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/transactions/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", user?.id] });
      toast({ title: "Transaction supprimée" });
    },
  });

  const editMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await apiRequest("PATCH", `/api/transactions/${id}`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", user?.id] });
      toast({ title: "Transaction modifiée", description: "Les soldes ont été recalculés." });
      setEditTx(null);
    },
  });

  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");

  const openEditTx = (tx: Transaction) => {
    setEditTx(tx);
    setEditAmount(String(tx.amount));
    setEditDesc(tx.description || "");
    setEditDate(tx.date);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTx) return;
    editMut.mutate({
      id: editTx.id,
      data: {
        amount: parseFloat(editAmount),
        description: editDesc || null,
        date: editDate,
      },
    });
  };

  const resetForm = () => {
    setForm({ type: "expense", accountId: "", toAccountId: "", category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], isRecurring: false, recurringFrequency: "monthly" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      userId: user!.id,
      accountId: parseInt(form.accountId),
      type: form.type,
      category: form.type === "transfer" ? "Transfert" : form.category,
      description: form.description || null,
      amount: parseFloat(form.amount),
      date: form.date,
      isRecurring: form.isRecurring ? 1 : 0,
      recurringFrequency: form.isRecurring ? form.recurringFrequency : null,
      toAccountId: form.type === "transfer" && form.toAccountId ? parseInt(form.toAccountId) : null,
    };
    createMut.mutate(payload);
  };

  // Available destination accounts for transfer (exclude source)
  const transferDestinations = form.accountId ? accounts.filter(a => a.id !== parseInt(form.accountId)) : accounts;

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterAccount !== "all" && t.accountId !== parseInt(filterAccount) && t.toAccountId !== parseInt(filterAccount)) return false;
      if (search) {
        const s = search.toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const cat = t.category.toLowerCase();
        if (!desc.includes(s) && !cat.includes(s)) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterAccount, search]);

  const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalTransfers = filtered.filter((t) => t.type === "transfer").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} transactions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-transaction" size="sm" onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle transaction</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={form.type === "income" ? "default" : "outline"}
                  className={form.type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  onClick={() => setForm({ ...form, type: "income", category: "", toAccountId: "" })}
                  data-testid="button-type-income"
                  size="sm"
                >
                  <ArrowUpRight className="w-4 h-4 mr-1" /> Revenu
                </Button>
                <Button
                  type="button"
                  variant={form.type === "expense" ? "default" : "outline"}
                  className={form.type === "expense" ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setForm({ ...form, type: "expense", category: "", toAccountId: "" })}
                  data-testid="button-type-expense"
                  size="sm"
                >
                  <ArrowDownRight className="w-4 h-4 mr-1" /> Dépense
                </Button>
                <Button
                  type="button"
                  variant={form.type === "transfer" ? "default" : "outline"}
                  className={form.type === "transfer" ? "bg-blue-600 hover:bg-blue-700" : ""}
                  onClick={() => setForm({ ...form, type: "transfer", category: "Transfert", toAccountId: "" })}
                  data-testid="button-type-transfer"
                  size="sm"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-1" /> Transfert
                </Button>
              </div>

              {/* Source account */}
              <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v, toAccountId: "" })}>
                <SelectTrigger data-testid="select-account">
                  <SelectValue placeholder={form.type === "transfer" ? "Compte source" : "Compte"} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.bankName} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Destination account for transfers */}
              {form.type === "transfer" && (
                <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                  <Label className="text-xs text-muted-foreground mb-2 block">Transférer vers</Label>
                  <Select value={form.toAccountId} onValueChange={(v) => setForm({ ...form, toAccountId: v })}>
                    <SelectTrigger data-testid="select-to-account">
                      <SelectValue placeholder="Compte de destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {transferDestinations.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.bankName} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category - only for income/expense */}
              {form.type !== "transfer" && (
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="select-category"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES[form.type].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Input data-testid="input-description" placeholder="Description (optionnel)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input data-testid="input-amount" type="number" step="0.01" placeholder="Montant" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              <Input data-testid="input-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />

              <div className="flex items-center gap-3">
                <Switch checked={form.isRecurring} onCheckedChange={(v) => setForm({ ...form, isRecurring: v })} data-testid="switch-recurring" />
                <Label className="text-sm">Récurrent</Label>
                {form.isRecurring && (
                  <Select value={form.recurringFrequency} onValueChange={(v) => setForm({ ...form, recurringFrequency: v })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Hebdo</SelectItem>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="yearly">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMut.isPending || (form.type === "transfer" && !form.toAccountId)}
              >
                {form.type === "transfer" ? "Effectuer le transfert" : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Revenus</p>
          <p className="text-lg font-bold text-emerald-500 tabular-nums">+{totalIncome.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Dépenses</p>
          <p className="text-lg font-bold text-red-500 tabular-nums">-{totalExpenses.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Transferts</p>
          <p className="text-lg font-bold text-blue-500 tabular-nums">{totalTransfers.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input data-testid="input-search" className="pl-9" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36" data-testid="filter-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            <SelectItem value="income">Revenus</SelectItem>
            <SelectItem value="expense">Dépenses</SelectItem>
            <SelectItem value="transfer">Transferts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-40" data-testid="filter-account"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les comptes</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((tx) => {
              const acc = accounts.find((a) => a.id === tx.accountId);
              const toAcc = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null;
              const isTransfer = tx.type === "transfer";

              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50" data-testid={`transaction-${tx.id}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isTransfer ? "bg-blue-500/10 text-blue-500" :
                    tx.type === "income" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  }`}>
                    {isTransfer ? <ArrowRightLeft className="w-4 h-4" /> :
                     tx.type === "income" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isTransfer && acc && toAcc ? (
                      <p className="text-sm font-medium truncate">
                        {acc.bankName} — {acc.name} ➡️ {toAcc.bankName} — {toAcc.name}
                      </p>
                    ) : (
                      <p className="text-sm font-medium truncate">{tx.description || tx.category}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tx.category}</Badge>
                      {!isTransfer && acc && <span className="text-[10px] text-muted-foreground">{acc.name}</span>}
                      {tx.isRecurring === 1 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Récurrent</Badge>}
                      {tx.description && isTransfer && (
                        <span className="text-[10px] text-muted-foreground">{tx.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${
                      isTransfer ? "text-blue-500" :
                      tx.type === "income" ? "text-emerald-500" : "text-red-500"
                    }`}>
                      {isTransfer ? "" : tx.type === "income" ? "+" : "-"}{tx.amount.toFixed(2)} €
                    </p>
                    <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => openEditTx(tx)} data-testid={`edit-tx-${tx.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => deleteMut.mutate(tx.id)} data-testid={`delete-tx-${tx.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">Aucune transaction trouvée</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Transaction Modal */}
      <Dialog open={!!editTx} onOpenChange={(v) => { if (!v) setEditTx(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Modifier la transaction
            </DialogTitle>
          </DialogHeader>
          {editTx && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={editTx.type === "income" ? "default" : editTx.type === "transfer" ? "secondary" : "destructive"} className="text-[10px]">
                    {editTx.type === "income" ? "Revenu" : editTx.type === "transfer" ? "Transfert" : "D\u00e9pense"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{editTx.category}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compte : {accounts.find(a => a.id === editTx.accountId)?.name || "?"}
                  {editTx.toAccountId && " \u279c " + (accounts.find(a => a.id === editTx.toAccountId)?.name || "?")}
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Montant</Label>
                <div className="relative">
                  <Input
                    data-testid="edit-tx-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="text-center text-lg font-bold h-12 pr-8"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">\u20ac</span>
                </div>
                {parseFloat(editAmount) !== editTx.amount && (
                  <p className="text-xs mt-1">
                    <span className="text-muted-foreground">Ancien montant : {editTx.amount.toFixed(2)} \u20ac</span>
                    <span className={`ml-2 font-medium ${parseFloat(editAmount) > editTx.amount ? "text-red-500" : "text-emerald-500"}`}>
                      ({parseFloat(editAmount) > editTx.amount ? "+" : ""}{(parseFloat(editAmount) - editTx.amount).toFixed(2)} \u20ac)
                    </span>
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
                <Input
                  data-testid="edit-tx-desc"
                  placeholder="Description (optionnel)"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
                <Input
                  data-testid="edit-tx-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={editMut.isPending} data-testid="edit-tx-submit">
                {editMut.isPending ? "Enregistrement..." : "Sauvegarder les modifications"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
