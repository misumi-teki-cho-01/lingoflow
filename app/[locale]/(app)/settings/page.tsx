import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-8 space-y-6">
        <div className="rounded-lg border border-border p-4">
          <label className="text-sm font-medium">{t("language")}</label>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the language switcher in the header to change the interface language.
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <label className="text-sm font-medium">{t("rewindDefault")}</label>
          <p className="mt-1 text-sm text-muted-foreground">
            Default: 5 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
