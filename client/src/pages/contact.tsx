import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Shield, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: user?.fullName || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });

  const sendMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contact-messages", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Message envoyé", description: "Votre message a été envoyé à KartenaDEP@gmail.com" });
      setSent(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMut.mutate({ ...form, userId: user?.id || null });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Contact & Support</h1>
        <p className="text-sm text-muted-foreground">Un souci technique ? Contactez le développeur</p>
      </div>

      {sent ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="font-medium mb-1">Message envoyé</p>
            <p className="text-sm text-muted-foreground">Nous traiterons votre demande dans les plus brefs délais.</p>
            <Button className="mt-4" onClick={() => { setSent(false); setForm({ name: user?.fullName || "", email: user?.email || "", subject: "", message: "" }); }}>
              Nouveau message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Formulaire de contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input data-testid="input-contact-name" placeholder="Votre nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input data-testid="input-contact-email" type="email" placeholder="Votre email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <Input data-testid="input-contact-subject" placeholder="Sujet" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              <Textarea data-testid="input-contact-message" placeholder="Décrivez votre problème..." rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
              <Button type="submit" disabled={sendMut.isPending} data-testid="button-send-contact">
                Envoyer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* RGPD */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" /> Politique de Confidentialité (RGPD)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p><strong className="text-foreground">1. Responsable du traitement</strong><br />
            KartenaDEP, application de gestion financière personnelle. Contact : KartenaDEP@gmail.com
          </p>
          <p><strong className="text-foreground">2. Données collectées</strong><br />
            Nous collectons les données que vous saisissez : nom, email, données financières (comptes, transactions, projets). Ces données sont nécessaires au fonctionnement de l'application.
          </p>
          <p><strong className="text-foreground">3. Finalité du traitement</strong><br />
            Vos données sont utilisées exclusivement pour vous fournir le service de gestion financière. Elles ne sont jamais vendues à des tiers.
          </p>
          <p><strong className="text-foreground">4. Durée de conservation</strong><br />
            Vos données sont conservées tant que votre compte est actif. Vous pouvez demander leur suppression à tout moment.
          </p>
          <p><strong className="text-foreground">5. Vos droits</strong><br />
            Conformément au RGPD, vous disposez des droits d'accès, de rectification, de suppression, de portabilité et d'opposition. Pour exercer ces droits, contactez-nous via le formulaire ci-dessus.
          </p>
          <p><strong className="text-foreground">6. Sécurité</strong><br />
            Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données contre tout accès non autorisé, altération ou destruction.
          </p>
          <p><strong className="text-foreground">7. Cookies</strong><br />
            L'application n'utilise pas de cookies tiers. Seules des données de session sont utilisées pour maintenir votre connexion.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
