import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, Mail, Clock, User } from "lucide-react";
import type { SharedReport } from "@shared/schema";
import { useState } from "react";

export default function SharePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));

  const { data: reports = [] } = useQuery<SharedReport[]>({
    queryKey: ["/api/shared-reports", user?.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/shared-reports/${user!.id}`); return r.json(); },
    enabled: !!user,
  });

  const shareMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/shared-reports", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-reports", user?.id] });
      toast({ title: "Rapport partagé", description: `Envoyé à ${recipientName}` });
      setRecipientName("");
      setRecipientEmail("");
    },
  });

  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    shareMut.mutate({
      userId: user!.id,
      recipientEmail,
      recipientName,
      month,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Partage</h1>
        <p className="text-sm text-muted-foreground">Partagez vos rapports avec votre famille</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Send className="w-4 h-4" /> Envoyer un rapport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleShare} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                data-testid="input-recipient-name"
                placeholder="Nom du destinataire"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
              <Input
                data-testid="input-recipient-email"
                type="email"
                placeholder="Email du destinataire"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                required
              />
            </div>
            <Input
              data-testid="input-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <Button type="submit" disabled={shareMut.isPending} data-testid="button-share">
              <Mail className="w-4 h-4 mr-2" /> Partager le rapport
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" /> Historique des partages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun rapport partagé</p>
          ) : (
            <div className="divide-y">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3" data-testid={`report-${r.id}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.recipientName}</p>
                    <p className="text-xs text-muted-foreground">{r.recipientEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{r.month}</p>
                    {r.sentAt && <p className="text-[10px] text-muted-foreground">{new Date(r.sentAt).toLocaleDateString("fr-FR")}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
