import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export default function LandingPage() {
  const t = useTranslations("landing");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight">LingoFlow</span>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("getStarted")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-xl text-muted-foreground">
            {t("subtitle")}
          </p>
          <p className="mt-4 text-base text-muted-foreground">
            {t("description")}
          </p>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-flex rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("getStarted")}
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          {(["shadow", "transcript", "annotation"] as const).map((feature) => (
            <div
              key={feature}
              className="rounded-lg border border-border bg-card p-6 text-center"
            >
              <h3 className="text-lg font-semibold">
                {t(`features.${feature}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`features.${feature}.description`)}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
