import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Save, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";

const settingsSchema = z.object({
  botToken: z.string().optional(),
  adminTelegramId: z.string().optional(),
  operatorUsername: z.string().optional(),
  welcomeMessage: z.string().optional(),
  rulesText: z.string().optional(),
  webhookUrl: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [webhookMessage, setWebhookMessage] = useState("");

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      botToken: "",
      adminTelegramId: "",
      operatorUsername: "",
      welcomeMessage: "",
      rulesText: "",
      webhookUrl: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        botToken: "",
        adminTelegramId: settings.adminTelegramId || "",
        operatorUsername: settings.operatorUsername || "",
        welcomeMessage: settings.welcomeMessage || "",
        rulesText: settings.rulesText || "",
        webhookUrl: settings.webhookUrl || "",
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      const payload: SettingsFormValues = { ...data };
      if (!payload.botToken || payload.botToken.trim() === "") {
        delete payload.botToken;
      }
      await updateSettings.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Ustawienia zapisane" });
    } catch {
      toast({ title: "Blad zapisu ustawien", variant: "destructive" });
    }
  };

  const handleSetWebhook = async () => {
    setWebhookStatus("loading");
    setWebhookMessage("");
    try {
      const res = await fetch("/api/settings/apply-webhook", { method: "POST" });
      const json = await res.json() as { ok?: boolean; error?: string; webhookUrl?: string };
      if (res.ok && json.ok) {
        setWebhookStatus("ok");
        setWebhookMessage(`Webhook ustawiony: ${json.webhookUrl}`);
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Webhook ustawiony poprawnie" });
      } else {
        setWebhookStatus("error");
        setWebhookMessage(json.error ?? "Nieznany blad");
        toast({ title: json.error ?? "Blad ustawiania webhooka", variant: "destructive" });
      }
    } catch {
      setWebhookStatus("error");
      setWebhookMessage("Blad polaczenia z serwerem");
      toast({ title: "Blad polaczenia z serwerem", variant: "destructive" });
    }
  };

  const deployedDomain = typeof window !== "undefined"
    ? window.location.origin
    : "";
  const suggestedWebhookUrl = deployedDomain
    ? `${deployedDomain}/api/telegram/webhook`
    : "https://twoja-domena.replit.app/api/telegram/webhook";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Ustawienia systemu</h1>
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Ustawienia systemu</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <Card className="bg-card border-border order-2 md:order-1">
          <CardHeader>
            <CardTitle>Konfiguracja</CardTitle>
            <CardDescription>Dane bota i operatora</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">

                <FormField
                  control={form.control}
                  name="botToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token bota Telegram</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Zostaw puste aby nie zmieniac tokena"
                          className="font-mono text-sm bg-background border-border"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground">
                        {settings?.botToken
                          ? "Token jest zapisany. Wpisz nowy tylko jesli chcesz go zmienic."
                          : "Wklej token z BotFather."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="adminTelegramId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Telegram ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="np. 6506504589"
                            className="font-mono text-sm bg-background border-border"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-muted-foreground">
                          Twoje numeryczne ID (sprawdz u @userinfobot)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="operatorUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username operatora</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="np. TwojNick (bez @)"
                            className="font-mono text-sm bg-background border-border"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-muted-foreground">
                          Telegram username bez znaku @
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="webhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={suggestedWebhookUrl}
                          className="font-mono text-xs bg-background border-border"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground">
                        Musi konczyc sie na <code className="bg-muted px-1 rounded">/api/telegram/webhook</code>
                        <br />
                        Sugerowany URL:{" "}
                        <button
                          type="button"
                          className="underline text-primary hover:text-primary/80"
                          onClick={() => form.setValue("webhookUrl", suggestedWebhookUrl)}
                        >
                          {suggestedWebhookUrl}
                        </button>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="welcomeMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wiadomosc powitalna</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Witaj w sklepie!"
                          className="min-h-[80px] font-mono text-sm bg-background border-border"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rulesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zasady</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="1. Platnosc z gory..."
                          className="min-h-[120px] font-mono text-sm bg-background border-border"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="border-t border-border pt-6 bg-card/50 flex justify-between">
                <Button type="button" variant="outline" className="border-border" onClick={() => form.reset()}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={updateSettings.isPending} className="gap-2">
                  {updateSettings.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Zapisz
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <div className="space-y-4 order-1 md:order-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Webhook</CardTitle>
              <CardDescription>Polacz bota z serwerem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kliknij aby zarejestrować webhook w Telegramie. Zapisz najpierw poprawny URL, potem kliknij ten przycisk.
                </p>
                <Button
                  variant="secondary"
                  className="w-full gap-2 border border-border"
                  onClick={handleSetWebhook}
                  disabled={webhookStatus === "loading"}
                >
                  {webhookStatus === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Webhook className="h-4 w-4" />
                  )}
                  Ustaw Webhook
                </Button>

                {webhookStatus === "ok" && (
                  <div className="flex items-start gap-2 text-xs text-green-400">
                    <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="break-all">{webhookMessage}</span>
                  </div>
                )}
                {webhookStatus === "error" && (
                  <div className="flex items-start gap-2 text-xs text-destructive">
                    <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{webhookMessage}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Status bota</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Token</span>
                <Badge variant={settings?.botToken ? "default" : "destructive"} className="text-xs">
                  {settings?.botToken ? "Skonfigurowany" : "Brak"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Admin ID</span>
                <Badge variant={settings?.adminTelegramId ? "default" : "destructive"} className="text-xs">
                  {settings?.adminTelegramId ? settings.adminTelegramId : "Brak"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Webhook</span>
                <Badge variant={settings?.webhookUrl?.includes("/api/telegram/webhook") ? "default" : "destructive"} className="text-xs">
                  {settings?.webhookUrl?.includes("/api/telegram/webhook") ? "Poprawny" : "Niezgodny"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Bezpieczenstwo tokena</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>Token bota jest przechowywany jako <strong>zaszyfrowany sekret Replit</strong> — nie jest widoczny w kodzie ani dla innych osob.</p>
              <p>Nie udostepniaj tokena nikomu. Jesli uwazasz ze zostal ujawniony, wygeneruj nowy w BotFather komenda <code className="bg-muted px-1 rounded">/revoke</code>.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
