"use client";

import { useActionState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { importVideo, type ImportVideoState } from "@/app/actions/import-video";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";

const INITIAL_STATE: ImportVideoState = {};

export function VideoImportForm() {
  const t = useTranslations("dashboard");
  const locale = useLocale();

  // Server Action error codes → i18n strings
  const ERROR_MESSAGES: Record<string, string> = {
    invalidUrl: t("errorInvalidUrl"),
    bilibiliUnsupported: t("errorBilibiliUnsupported"),
    noSubtitles: t("errorNoSubtitles"),
    saveFailed: t("errorSaveFailed"),
  };

  // Bind locale into the server action
  const importWithLocale = importVideo.bind(null, locale);
  const [state, action, isPending] = useActionState(importWithLocale, INITIAL_STATE);

  // Auto-focus input on mount
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <form action={action} className="w-full max-w-2xl">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            name="url"
            type="url"
            placeholder={t("urlPlaceholder")}
            disabled={isPending}
            className={`h-11 pr-4 ${state.error ? "border-destructive ring-destructive/20" : ""}`}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="lg" disabled={isPending} className="shrink-0 gap-2">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("importing")}
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" />
              {t("importVideo")}
            </>
          )}
        </Button>
      </div>

      {/* Error message */}
      {state.error && (
        <p className="mt-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
          {ERROR_MESSAGES[state.error] ?? state.error}
        </p>
      )}


      {/* Loading hint */}
      {isPending && (
        <p className="mt-2 text-sm text-muted-foreground animate-in fade-in">
          {t("importingHint")}
        </p>
      )}
    </form>
  );
}
