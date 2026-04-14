"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LandingPage() {
  const t = useTranslations("landing");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (remember) {
        localStorage.setItem("lingo-remember", "1");
      } else {
        localStorage.setItem("lingo-remember", "0");
        sessionStorage.setItem("lingo-active", "1");
      }
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight">LingoFlow</span>
          <LocaleSwitcher />
        </div>
      </header>

      {/* Main — two-column on lg, stacked on mobile */}
      <main className="flex flex-1 flex-col lg:flex-row">

        {/* Left — product intro */}
        <div className="flex flex-col justify-center px-8 py-16 lg:w-1/2 lg:px-16 xl:px-24">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl leading-tight">
              {t("title")}
            </h1>
            <p className="mt-3 text-xl text-muted-foreground font-medium">
              {t("subtitle")}
            </p>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              {t("description")}
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-4">
              {(["shadow", "transcript", "annotation"] as const).map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    ✓
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t(`features.${feature}.title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`features.${feature}.description`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider (visible on lg) */}
        <div className="hidden lg:block w-px bg-border self-stretch my-8" />

        {/* Right — login form */}
        <div className="flex flex-col justify-center px-8 py-16 lg:w-1/2 lg:px-16 xl:px-24">
          <div className="w-full max-w-sm mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{t("login.welcomeBack")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("login.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{t("login.passwordLabel")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  {t("login.rememberMe")}
                </Label>
              </div>

              {error && (
                <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>
          </div>
        </div>

      </main>
    </div>
  );
}
