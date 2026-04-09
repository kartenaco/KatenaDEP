import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import type { Account, Transaction, MonthlySnapshot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import { format, subDays, startOfWeek, startOfMonth, startOfYear, isAfter, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = [
  "hsl(210, 90%, 50%)",
  "hsl(160, 60%, 42%)",
  "hsl(270, 60%, 55%)",
  "hsl(40, 85%, 52%)",
  "hsl(350, 70%, 55%)",
  "hsl(320, 60%, 50%)",
  "hsl(180, 60%, 40%)",
  "hsl(30, 80%, 50%)",
];

type Period = "day" | "week" | "month" | "year";
type ChartType = "bar" | "pie";

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [revenueChartType, setRevenueChartType] = useState<ChartType>("bar");
  const [expenseChartType, setExpenseChartType] = useState<ChartType>("pie");

  const { data: accounts = [], isLoading: accLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/accounts/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/transactions/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  const { data: snapshots = [] } = useQuery<MonthlySnapshot[]>({
    queryKey: ["/api/snapshots", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/snapshots/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  // Filtered transactions by period
  const filteredTx = useMemo(() => {
    const now = new Date();
    let start: Date;
    switch (period) {
      case "day": start = subDays(now, 1); break;
      case "week": start = startOfWeek(now, { locale: fr }); break;
      case "month": start = startOfMonth(now); break;
      case "year": start = startOfYear(now); break;
    }
    return transactions.filter((t) => isAfter(parseISO(t.date), start));
  }, [transactions, period]);

  // KPIs
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalIncome = filteredTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Previous month comparison
  const currentMonth = format(new Date(), "yyyy-MM");
  const prevMonth = format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), "yyyy-MM");
  const currentSnaps = snapshots.filter((s) => s.month === currentMonth);
  const prevSnaps = snapshots.filter((s) => s.month === prevMonth);
  const currentTotal = currentSnaps.reduce((s, sn) => s + sn.closingBalance, 0);
  const prevTotal = prevSnaps.reduce((s, sn) => s + sn.closingBalance, 0);
  const progressPct = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

  // Category breakdown for expense pie chart
  const expenseCategoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredTx.filter((t) => t.type === "expense").forEach((t) => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  // Category breakdown for income pie chart
  const incomeCategoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredTx.filter((t) => t.type === "income").forEach((t) => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  // Monthly bar chart data
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; revenus: number; depenses: number }> = {};
    transactions.forEach((t) => {
      if (t.type === "transfer") return; // Transfers don't count as income/expense
      const m = t.date.substring(0, 7);
      if (!months[m]) months[m] = { month: m, revenus: 0, depenses: 0 };
      if (t.type === "income") months[m].revenus += t.amount;
      else months[m].depenses += t.amount;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [transactions]);

  if (accLoading || txLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-dashboard-title">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de vos finances</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="day" data-testid="tab-day">Jour</TabsTrigger>
            <TabsTrigger value="week" data-testid="tab-week">Semaine</TabsTrigger>
            <TabsTrigger value="month" data-testid="tab-month">Mois</TabsTrigger>
            <TabsTrigger value="year" data-testid="tab-year">Année</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Solde Global"
          value={totalBalance}
          icon={<Wallet className="w-4 h-4" />}
          trend={progressPct}
          testId="kpi-balance"
        />
        <KPICard
          title="Revenus"
          value={totalIncome}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-emerald-500"
          testId="kpi-income"
        />
        <KPICard
          title="Dépenses"
          value={totalExpenses}
          icon={<TrendingDown className="w-4 h-4" />}
          color="text-red-500"
          testId="kpi-expenses"
        />
        <KPICard
          title="Taux d'épargne"
          value={savingsRate}
          suffix="%"
          isCurrency={false}
          icon={<PiggyBank className="w-4 h-4" />}
          trend={progressPct}
          testId="kpi-savings"
        />
      </div>

      {/* Comparison badge */}
      {prevTotal > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant={progressPct >= 0 ? "default" : "destructive"} data-testid="badge-progress">
            {progressPct >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {Math.abs(progressPct).toFixed(1)}% vs mois dernier
          </Badge>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue/Expense chart with type selector */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus vs Dépenses</CardTitle>
            <Select value={revenueChartType} onValueChange={(v) => setRevenueChartType(v as ChartType)}>
              <SelectTrigger className="w-[130px] h-8" data-testid="select-revenue-chart">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barres</SelectItem>
                <SelectItem value="pie">Camembert</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-revenue">
              <ResponsiveContainer width="100%" height="100%">
                {revenueChartType === "bar" ? (
                  <BarChart data={monthlyData}>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220,15%,88%)" }}
                      formatter={(v: number) => `${v.toFixed(2)} €`}
                    />
                    <Bar dataKey="revenus" fill="hsl(160, 60%, 42%)" radius={[4, 4, 0, 0]} name="Revenus" />
                    <Bar dataKey="depenses" fill="hsl(350, 70%, 55%)" radius={[4, 4, 0, 0]} name="Dépenses" />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Revenus", value: Math.round(totalIncome * 100) / 100 },
                        { name: "Dépenses", value: Math.round(totalExpenses * 100) / 100 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="hsl(160, 60%, 42%)" />
                      <Cell fill="hsl(350, 70%, 55%)" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)} €`} />
                    <Legend />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense breakdown chart with type selector */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Répartition des dépenses</CardTitle>
            <Select value={expenseChartType} onValueChange={(v) => setExpenseChartType(v as ChartType)}>
              <SelectTrigger className="w-[130px] h-8" data-testid="select-expense-chart">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pie">Camembert</SelectItem>
                <SelectItem value="bar">Barres</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-expense">
              <ResponsiveContainer width="100%" height="100%">
                {expenseChartType === "pie" ? (
                  <PieChart>
                    <Pie
                      data={expenseCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {expenseCategoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)} €`} />
                  </PieChart>
                ) : (
                  <BarChart data={expenseCategoryData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220,15%,88%)" }}
                      formatter={(v: number) => `${v.toFixed(2)} €`}
                    />
                    <Bar dataKey="value" name="Montant" radius={[0, 4, 4, 0]}>
                      {expenseCategoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Vos comptes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                data-testid={`account-card-${acc.id}`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                  style={{ backgroundColor: acc.color }}
                >
                  {acc.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{acc.name}</p>
                  <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{acc.balance.toFixed(2)} €</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  title, value, icon, color, trend, suffix = "€", isCurrency = true, testId,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  trend?: number;
  suffix?: string;
  isCurrency?: boolean;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <div className={`p-1.5 rounded-md bg-primary/10 ${color || "text-primary"}`}>
            {icon}
          </div>
        </div>
        <p className="text-xl font-bold tabular-nums">
          {isCurrency ? value.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : value.toFixed(1)}
          <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>
        </p>
        {trend !== undefined && (
          <div className="flex items-center mt-1">
            {trend > 0 ? (
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
            ) : trend < 0 ? (
              <ArrowDownRight className="w-3 h-3 text-red-500" />
            ) : (
              <Minus className="w-3 h-3 text-muted-foreground" />
            )}
            <span className={`text-xs ml-1 ${trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
