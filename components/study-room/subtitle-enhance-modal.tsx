"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { JsonValidationBadge } from "@/components/ui/json-validation-badge";
import {
  CheckCircle2,
  ChevronLeft,
  Copy,
  Languages,
  Save,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { getEnhancementPrompt } from "@/lib/ai/prompts";
import { useJsonValidation } from "@/hooks/use-json-validation";
import type { TranscriptSegment } from "@/types/transcript";

const PROMPT_LANGUAGE_KEY = "lingo-prompt-language";

const LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

type Step = "copy_prompt" | "paste_response" | "preview";
type Notice = {
  tone: "success" | "error";
  text: string;
} | null;

export interface SubtitleEnhanceModalProps {
  visible: boolean;
  segments: TranscriptSegment[];
  /** Original raw segments before any AI enhancement. When provided, shows a
   *  source toggle so the user can re-enhance from scratch. */
  rawSegments?: TranscriptSegment[];
  onCancel: () => void;
  onSave: (enhanced: TranscriptSegment[]) => Promise<void>;
}

function buildEnhancePrompt(segments: TranscriptSegment[], lang: string): string {
  const input = JSON.stringify(
    segments.map((s) => ({ start_time: s.start_time, end_time: s.end_time, text: s.text })),
    null,
    2
  );
  return `${getEnhancementPrompt(lang)}\n\nTranscript:\n${input}`;
}

export function SubtitleEnhanceModal({
  visible,
  segments,
  rawSegments,
  onCancel,
  onSave,
}: SubtitleEnhanceModalProps) {
  const t = useTranslations("studyRoom");
  const locale = useLocale();

  // "current" = already-enhanced liveSegments; "raw" = original YouTube subtitles
  const [sourceMode, setSourceMode] = useState<"current" | "raw">("current");
  const [step, setStep] = useState<Step>("copy_prompt");
  const [editablePrompt, setEditablePrompt] = useState("");
  const [pastedJson, setPastedJson] = useState("");
  const [enhancedSegments, setEnhancedSegments] = useState<TranscriptSegment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptLanguage, setPromptLanguage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(PROMPT_LANGUAGE_KEY) || locale;
    }
    return locale;
  });
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const jsonValidation = useJsonValidation(
    step === "paste_response" ? pastedJson : "",
    "segments"
  );

  useEffect(() => {
    if (!visible) return;
    setStep("copy_prompt");
    setSourceMode("current");
    const saved = typeof window !== "undefined" ? localStorage.getItem(PROMPT_LANGUAGE_KEY) : null;
    const lang = saved || locale;
    setPromptLanguage(lang);
    setEditablePrompt(buildEnhancePrompt(segments, lang));
    setPastedJson("");
    setEnhancedSegments([]);
    setIsSaving(false);
    setNotice(null);
    setPromptCopied(false);
  }, [visible, segments, locale]);

  const activeSegments = sourceMode === "raw" && rawSegments ? rawSegments : segments;

  const handleLanguageChange = (lang: string) => {
    setPromptLanguage(lang);
    localStorage.setItem(PROMPT_LANGUAGE_KEY, lang);
    setEditablePrompt(buildEnhancePrompt(activeSegments, lang));
  };

  const handleSourceModeChange = (mode: "current" | "raw") => {
    setSourceMode(mode);
    const src = mode === "raw" && rawSegments ? rawSegments : segments;
    setEditablePrompt(buildEnhancePrompt(src, promptLanguage));
  };

  if (!visible) return null;

  const handleCopyAndContinue = async () => {
    try {
      await navigator.clipboard.writeText(editablePrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
      setNotice({ tone: "success", text: t("promptCopiedToast") });
      setStep("paste_response");
    } catch {
      setNotice({ tone: "error", text: t("copyPromptFailed") });
    }
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(pastedJson) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setNotice({ tone: "error", text: t("enhanceJsonInvalid") });
        return;
      }
      const isValid = parsed.every(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof (s as Record<string, unknown>).start_time === "number" &&
          typeof (s as Record<string, unknown>).end_time === "number" &&
          typeof (s as Record<string, unknown>).text === "string" &&
          ((s as Record<string, unknown>).text as string).length > 0
      );
      if (!isValid) {
        setNotice({ tone: "error", text: t("enhanceJsonInvalid") });
        return;
      }
      setEnhancedSegments(parsed as TranscriptSegment[]);
      setStep("preview");
      setNotice(null);
    } catch {
      setNotice({ tone: "error", text: t("enhanceJsonInvalid") });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(enhancedSegments);
    } catch {
      setNotice({ tone: "error", text: t("saveFailed") });
    } finally {
      setIsSaving(false);
    }
  };

  const stepTitle = {
    copy_prompt: t("enhancePromptTitle"),
    paste_response: t("enhancePasteTitle"),
    preview: t("enhancePreviewTitle"),
  }[step];

  const stepDesc = {
    copy_prompt: t("enhancePromptDesc"),
    paste_response: t("enhancePasteDesc"),
    preview: t("enhancePreviewDesc", { from: segments.length, to: enhancedSegments.length }),
  }[step];

  const noticeClass =
    notice?.tone === "success"
      ? "border-emerald-300/70 bg-emerald-50 text-emerald-700"
      : "border-red-300/70 bg-red-50 text-red-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-card shadow-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-violet-500" />
              {stepTitle}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{stepDesc}</p>
          </div>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            {t("close")}
          </Button>
        </div>

        {/* Notice */}
        {notice && (
          <div className={`mx-6 mt-4 rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${noticeClass}`}>
            {notice.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10 custom-scrollbar">
          {step === "copy_prompt" && (
            <div className="space-y-4">
              {/* Source selector — only shown when raw segments are available */}
              {rawSegments && rawSegments.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 px-3 py-2">
                  <span className="text-sm font-medium shrink-0 text-amber-700 dark:text-amber-400">
                    {t("enhanceSource")}
                  </span>
                  <div className="flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-700 bg-background p-0.5">
                    {(["current", "raw"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => handleSourceModeChange(mode)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          sourceMode === mode
                            ? "bg-amber-500 text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {mode === "current" ? t("enhanceSourceCurrent") : t("enhanceSourceRaw")}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-amber-600 dark:text-amber-500">
                    {sourceMode === "raw"
                      ? t("enhanceSourceRawHint", { count: rawSegments.length })
                      : t("enhanceSourceCurrentHint", { count: segments.length })}
                  </span>
                </div>
              )}

              {/* Language selector */}
              <div className="flex items-center gap-3">
                <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium shrink-0">{t("promptLanguage")}</span>
                <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-0.5">
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleLanguageChange(opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        promptLanguage === opt.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("promptEditableLabel")}</label>
                <textarea
                  value={editablePrompt}
                  onChange={(e) => setEditablePrompt(e.target.value)}
                  className="min-h-[380px] w-full rounded-lg border border-input bg-background px-3 py-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar"
                />
              </div>
            </div>
          )}

          {step === "paste_response" && (
            <div className="space-y-2">
              <label htmlFor="enhance-json" className="text-sm font-medium">
                {t("enhancePasteLabel")}
              </label>
              <textarea
                id="enhance-json"
                ref={pasteTextareaRef}
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder={'[{"start_time": 0.0, "end_time": 2.5, "text": "..."}, ...]'}
                className={`min-h-[300px] w-full rounded-lg border bg-background px-3 py-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 custom-scrollbar transition-colors ${
                  jsonValidation.status === "invalid"
                    ? "border-red-400 focus-visible:ring-red-400"
                    : jsonValidation.status === "valid"
                      ? "border-emerald-400 focus-visible:ring-emerald-400"
                      : "border-input focus-visible:ring-ring"
                }`}
              />
              <JsonValidationBadge
                validation={jsonValidation}
                onJump={() => jsonValidation.jumpToError(pasteTextareaRef.current)}
                validLabel={`✓ 共 ${jsonValidation.itemCount} 条字幕`}
              />
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                {t("enhancePreviewDesc", { from: segments.length, to: enhancedSegments.length })}
              </div>
              <div className="w-full border rounded-lg overflow-hidden bg-background">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-4 py-3 w-20">Time</th>
                      <th className="px-4 py-3">Text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enhancedSegments.slice(0, 8).map((seg, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {seg.start_time.toFixed(1)}s
                        </td>
                        <td className="px-4 py-3">{seg.text}</td>
                      </tr>
                    ))}
                    {enhancedSegments.length > 8 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-xs text-center text-muted-foreground">
                          … {enhancedSegments.length - 8} more segments
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 bg-muted/20 flex gap-3 justify-end items-center">
          {step === "copy_prompt" && (
            <Button onClick={handleCopyAndContinue} disabled={!editablePrompt.trim()} className="gap-2">
              {promptCopied ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {t("copyAndContinue")}
            </Button>
          )}

          {step === "paste_response" && (
            <>
              <Button variant="outline" onClick={() => setStep("copy_prompt")} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                {t("backToPromptEditor")}
              </Button>
              <Button onClick={handleApplyJson} disabled={!pastedJson.trim()} className="gap-2">
                {t("applyJson")}
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("paste_response")} disabled={isSaving} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                {t("backToPasteJson")}
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? t("saving") : t("saveToDb")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
