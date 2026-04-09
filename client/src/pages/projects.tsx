import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Clock, Loader2, CheckCircle2 } from "lucide-react";
import type { Project } from "@shared/schema";
import { useState } from "react";

const STATUSES = [
  { value: "waiting", label: "En attente", icon: Clock, color: "text-amber-500 bg-amber-500/10" },
  { value: "in_progress", label: "En cours", icon: Loader2, color: "text-blue-500 bg-blue-500/10" },
  { value: "done", label: "Terminé", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
];

const PRIORITIES = [
  { value: "low", label: "Basse", color: "bg-slate-500" },
  { value: "medium", label: "Moyenne", color: "bg-amber-500" },
  { value: "high", label: "Haute", color: "bg-red-500" },
];

export default function ProjectsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", status: "waiting", budget: "", priority: "medium" });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/projects/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/projects", data); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", user?.id] });
      toast({ title: "Projet ajouté" });
      setOpen(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await apiRequest("PATCH", `/api/projects/${id}`, data);
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", user?.id] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/projects/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", user?.id] });
      toast({ title: "Projet supprimé" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      ...form,
      budget: form.budget ? parseFloat(form.budget) : null,
      userId: user!.id,
      position: projects.length,
    });
    setForm({ title: "", description: "", status: "waiting", budget: "", priority: "medium" });
  };

  const moveProject = (id: number, newStatus: string) => {
    updateMut.mutate({ id, data: { status: newStatus } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Projets</h1>
          <p className="text-sm text-muted-foreground">Gérez vos projets et objectifs financiers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-project" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nouveau projet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau projet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input data-testid="input-project-title" placeholder="Titre du projet" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <Textarea data-testid="input-project-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input data-testid="input-project-budget" type="number" step="0.01" placeholder="Budget (€)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger data-testid="select-priority"><SelectValue placeholder="Priorité" /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-status"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUSES.map((status) => {
          const StatusIcon = status.icon;
          const statusProjects = projects.filter((p) => p.status === status.value);
          return (
            <div key={status.value} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${status.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-semibold">{status.label}</h2>
                <Badge variant="secondary" className="text-[10px] ml-auto">{statusProjects.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px] p-2 rounded-lg bg-muted/30 border border-dashed">
                {statusProjects.map((project) => {
                  const prio = PRIORITIES.find((p) => p.value === project.priority);
                  return (
                    <Card key={project.id} className="cursor-default" data-testid={`project-${project.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-sm font-medium leading-tight">{project.title}</h3>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => deleteMut.mutate(project.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{project.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {project.budget && (
                            <Badge variant="outline" className="text-[10px]">{project.budget.toLocaleString("fr-FR")} €</Badge>
                          )}
                          {prio && (
                            <div className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${prio.color}`} />
                              <span className="text-[10px] text-muted-foreground">{prio.label}</span>
                            </div>
                          )}
                        </div>
                        {/* Move buttons */}
                        <div className="flex gap-1 mt-2">
                          {STATUSES.filter((s) => s.value !== status.value).map((s) => (
                            <Button
                              key={s.value}
                              variant="ghost"
                              size="sm"
                              className="text-[10px] h-6 px-2"
                              onClick={() => moveProject(project.id, s.value)}
                              data-testid={`move-${project.id}-${s.value}`}
                            >
                              → {s.label}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
