import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JsonValidationBadge } from "@/components/ui/json-validation-badge";
import {
  CheckCircle2,
  Copy,
  FileJson,
  Save,
  TriangleAlert,
  ChevronLeft,
  Languages,
  Loader2,
} from "lucide-react";
import type { VocabularyExplanation } from "@/lib/ai/services";
import type { SelectedWord } from "@/hooks/use-vocabulary-review";
import { getExplainDictationPrompt } from "@/lib/ai/prompts";
import { useJsonValidation } from "@/hooks/use-json-validation";

export type { SelectedWord };

type Step = "review_words" | "prompt_editor" | "paste_json" | "review_ai";
type Notice = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

const PROMPT_LANGUAGE_KEY = "lingo-prompt-language";

const LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

export interface VocabularyReviewModalProps {
  visible: boolean;
  initialWords: SelectedWord[];
  initialStep?: Step;
  onCancel: () => void;
  onSave: (
    finalData: Record<string, VocabularyExplanation>,
    transforms: { id: string; newText: string }[],
    options: { persistReviewedTranscript: boolean }
  ) => Promise<void>;
  getContextText: () => Promise<string>;
  showPersistOption?: boolean;
  onFeedback?: (notice: Notice) => void;
}

interface RowState {
  id: string;
  original_text: string;
  canonical_form: string;
  explanation: string;
}

function normalizeDefinitions(input: string): VocabularyExplanation[] {
  const parsed = JSON.parse(input) as unknown;

  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is VocabularyExplanation => {
      if (!item || typeof item !== "object") return false;
      const value = item as Record<string, unknown>;
      return (
        typeof value.original_text === "string" &&
        typeof value.canonical_form === "string" &&
        typeof value.explanation === "string"
      );
    });
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid JSON shape");
  }

  return Object.values(parsed).filter((item): item is VocabularyExplanation => {
    if (!item || typeof item !== "object") return false;
    const value = item as Record<string, unknown>;
    return (
      typeof value.original_text === "string" &&
      typeof value.canonical_form === "string" &&
      typeof value.explanation === "string"
    );
  });
}

export function VocabularyReviewModal({
  visible,
  initialWords,
  initialStep = "review_words",
  onCancel,
  onSave,
  getContextText,
  showPersistOption = false,
  onFeedback,
}: VocabularyReviewModalProps) {
  const t = useTranslations("studyRoom");
  const locale = useLocale();

  const [step, setStep] = useState<Step>(initialStep);
  const [rows, setRows] = useState<RowState[]>([]);
  const [pastedJson, setPastedJson] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [persistReviewedTranscript, setPersistReviewedTranscript] = useState(true);

  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const jsonValidation = useJsonValidation(
    step === "paste_json" ? pastedJson : "",
    "vocabulary"
  );

  // Prompt editor state
  const [promptLanguage, setPromptLanguage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(PROMPT_LANGUAGE_KEY) || locale;
    }
    return locale;
  });
  const [editablePrompt, setEditablePrompt] = useState("");
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const fetchedContextRef = useRef<string>("");

  useEffect(() => {
    if (!visible) return;

    setStep(initialStep);
    setPastedJson("");
    setIsSaving(false);
    setNotice(null);
    setPersistReviewedTranscript(true);
    setEditablePrompt("");
    setPromptCopied(false);
    fetchedContextRef.current = "";
    setRows(
      initialWords.map((w) => ({
        id: w.id,
        original_text: w.text.trim(),
        canonical_form: "",
        explanation: "",
      }))
    );
    // Read persisted language preference
    const saved = typeof window !== "undefined" ? localStorage.getItem(PROMPT_LANGUAGE_KEY) : null;
    setPromptLanguage(saved || locale);
  }, [visible, initialWords, initialStep, locale]);

  const uniqueWords = useMemo(
    () => Array.from(new Set(rows.map((row) => row.original_text).filter(Boolean))),
    [rows]
  );

  if (!visible) return null;

  const updateNotice = (nextNotice: Notice) => {
    setNotice(nextNotice);
    onFeedback?.(nextNotice);
  };

  const handleUpdateRow = (id: string, field: keyof RowState, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const buildPrompt = (context: string, lang: string) => {
    const template = getExplainDictationPrompt(lang);
    return template
      .replace("{{text}}", context)
      .replace("{{words}}", JSON.stringify(uniqueWords, null, 2));
  };

  const handleGoToPromptEditor = async () => {
    setIsLoadingPrompt(true);
    try {
      let ctx = fetchedContextRef.current;
      if (!ctx) {
        ctx = await getContextText();
        fetchedContextRef.current = ctx;
      }
      setEditablePrompt(buildPrompt(ctx, promptLanguage));
      setStep("prompt_editor");
    } catch {
      updateNotice({ tone: "error", text: t("copyPromptFailed") });
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setPromptLanguage(lang);
    localStorage.setItem(PROMPT_LANGUAGE_KEY, lang);
    if (fetchedContextRef.current) {
      setEditablePrompt(buildPrompt(fetchedContextRef.current, lang));
    }
  };

  const handleCopyAndContinue = async () => {
    try {
      await navigator.clipboard.writeText(editablePrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
      updateNotice({ tone: "success", text: t("promptCopiedToast") });
      setStep("paste_json");
    } catch {
      updateNotice({ tone: "error", text: t("copyPromptFailed") });
    }
  };

  const handleApplyJson = () => {
    try {
      const definitions = normalizeDefinitions(pastedJson);
      const byOriginal = new Map(
        definitions.map((item) => [item.original_text.trim().toLowerCase(), item])
      );

      let matchedCount = 0;
      const nextRows = rows.map((row) => {
        const match = byOriginal.get(row.original_text.trim().toLowerCase());
        if (!match) return row;
        matchedCount += 1;
        return {
          ...row,
          canonical_form: match.canonical_form,
          explanation: match.explanation,
        };
      });

      if (matchedCount === 0) {
        updateNotice({ tone: "error", text: t("jsonNoMatch") });
        return;
      }

      setRows(nextRows);
      setStep("review_ai");
      updateNotice({
        tone: "success",
        text: t("jsonParsed", { count: matchedCount }),
      });
    } catch {
      updateNotice({ tone: "error", text: t("jsonInvalid") });
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const finalData: Record<string, VocabularyExplanation> = {};
      const transforms: { id: string; newText: string }[] = [];

      rows.forEach((row) => {
        if (!row.original_text || !row.explanation) return;

        finalData[row.original_text] = {
          original_text: row.original_text,
          canonical_form: row.canonical_form || row.original_text,
          explanation: row.explanation,
        };

        const originalWordInfo = initialWords.find((initial) => initial.id === row.id);
        if (originalWordInfo && originalWordInfo.text !== row.original_text) {
          transforms.push({ id: row.id, newText: row.original_text });
        }
      });

      await onSave(finalData, transforms, {
        persistReviewedTranscript,
      });
      updateNotice({ tone: "success", text: t("saveSuccess") });
    } catch {
      updateNotice({ tone: "error", text: t("saveFailed") });
    } finally {
      setIsSaving(false);
    }
  };

  const noticeClassName =
    notice?.tone === "success"
      ? "border-emerald-300/70 bg-emerald-50 text-emerald-700"
      : notice?.tone === "error"
        ? "border-red-300/70 bg-red-50 text-red-700"
        : "border-sky-300/70 bg-sky-50 text-sky-700";

  const stepTitle = {
    review_words: t("reviewSelectionTitle"),
    prompt_editor: t("promptEditorTitle"),
    paste_json: t("pasteJsonTitle"),
    review_ai: t("reviewDefinitionsTitle"),
  }[step];

  const stepDesc = {
    review_words: t("reviewSelectionDesc"),
    prompt_editor: t("promptEditorDesc"),
    paste_json: t("pasteJsonDesc"),
    review_ai: t("reviewDefinitionsDesc"),
  }[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-card shadow-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{stepTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1">{stepDesc}</p>
          </div>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            {t("close")}
          </Button>
        </div>

        {/* Notice */}
        {notice && (
          <div className={`mx-6 mt-4 rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${noticeClassName}`}>
            {notice.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : notice.tone === "error" ? (
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <FileJson className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10 custom-scrollbar">
          {rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              {t("noVocabularySelected")}
            </div>
          ) : step === "prompt_editor" ? (
            /* ── Prompt Editor ── */
            <div className="space-y-4">
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

              {/* Selected words reminder */}
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <div className="text-sm font-medium">{t("selectedWords")}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {uniqueWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700"
                    >
                      {word}
                    </span>
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
          ) : step === "paste_json" ? (
            /* ── Paste JSON ── */
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <div className="text-sm font-medium">{t("selectedWords")}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {uniqueWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="vocabulary-json" className="text-sm font-medium">
                  {t("pasteJsonLabel")}
                </label>
                <textarea
                  id="vocabulary-json"
                  ref={pasteTextareaRef}
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder={t("pasteJsonPlaceholder")}
                  className={`min-h-[280px] w-full rounded-lg border bg-background px-3 py-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 custom-scrollbar transition-colors ${
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
                  validLabel={`✓ 共 ${jsonValidation.itemCount} 条释义`}
                />
              </div>
            </div>
          ) : (
            /* ── Review words / Review AI ── */
            <div className="w-full border rounded-lg overflow-hidden bg-background">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-4 py-3 min-w-[150px]">{t("detectedWord")}</th>
                    <th className="px-4 py-3 min-w-[150px]">{t("canonicalForm")}</th>
                    <th className="px-4 py-3 w-1/2">{t("explanation")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 align-top font-medium text-indigo-500">
                        {row.original_text}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {step === "review_words" ? (
                          <span className="text-muted-foreground">{t("waitingForJson")}</span>
                        ) : (
                          <Input
                            value={row.canonical_form}
                            onChange={(e) => handleUpdateRow(row.id, "canonical_form", e.target.value)}
                            className="h-8 text-sm"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {step === "review_words" ? (
                          <span className="text-muted-foreground">{t("pasteJsonHintInline")}</span>
                        ) : (
                          <textarea
                            value={row.explanation}
                            onChange={(e) => handleUpdateRow(row.id, "explanation", e.target.value)}
                            className="w-full min-h-[60px] text-sm p-2 rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 bg-muted/20 flex gap-3 justify-end items-center">
          {step === "review_words" && rows.length > 0 && (
            <>
              <Button variant="ghost" onClick={() => setStep("review_ai")} className="mr-auto text-muted-foreground">
                {t("fillManually")}
              </Button>
              <Button variant="outline" onClick={() => setStep("paste_json")}>
                {t("goToPasteJson")}
              </Button>
              <Button onClick={handleGoToPromptEditor} disabled={isLoadingPrompt} className="gap-2">
                {isLoadingPrompt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {isLoadingPrompt ? t("loadingPrompt") : t("goToPromptEditor")}
              </Button>
            </>
          )}

          {step === "prompt_editor" && (
            <>
              <Button variant="outline" onClick={() => setStep("review_words")} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                {t("backToSelection")}
              </Button>
              <Button
                onClick={handleCopyAndContinue}
                disabled={!editablePrompt.trim()}
                className="gap-2"
              >
                {promptCopied ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {t("copyAndContinue")}
              </Button>
            </>
          )}

          {step === "paste_json" && (
            <>
              <Button variant="outline" onClick={() => setStep("prompt_editor")} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                {t("backToPromptEditor")}
              </Button>
              <Button onClick={handleApplyJson} disabled={!pastedJson.trim()} className="gap-2">
                <FileJson className="h-4 w-4" />
                {t("applyJson")}
              </Button>
            </>
          )}

          {step === "review_ai" && (
            <>
              {showPersistOption && (
                <div className="mr-auto flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <input
                    id="persist-reviewed-transcript"
                    type="checkbox"
                    checked={persistReviewedTranscript}
                    onChange={(e) => setPersistReviewedTranscript(e.target.checked)}
                    className="h-4 w-4 rounded border border-input"
                  />
                  <Label htmlFor="persist-reviewed-transcript" className="text-xs text-muted-foreground leading-5">
                    {t("persistReviewedTranscript")}
                  </Label>
                </div>
              )}
              <Button variant="outline" onClick={() => setStep("paste_json")} disabled={isSaving} className="gap-2">
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
