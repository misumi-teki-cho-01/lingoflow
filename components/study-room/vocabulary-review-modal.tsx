import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Copy, FileJson, Save, TriangleAlert } from "lucide-react";
import type { VocabularyExplanation } from "@/lib/ai/services";
import type { HighlightedWord } from "@/components/scribe/echo-editor";

type Step = "review_words" | "paste_json" | "review_ai";
type Notice = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

export interface VocabularyReviewModalProps {
  visible: boolean;
  initialWords: HighlightedWord[];
  initialStep?: Step;
  onCancel: () => void;
  onSave: (
    finalData: Record<string, VocabularyExplanation>,
    transforms: { id: string; newText: string }[],
    options: { persistReviewedTranscript: boolean }
  ) => Promise<void>;
  onCopyPrompt: () => Promise<{ ok: boolean; message: string }>;
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
  onCopyPrompt,
  onFeedback,
}: VocabularyReviewModalProps) {
  const t = useTranslations("studyRoom");

  const [step, setStep] = useState<Step>(initialStep);
  const [rows, setRows] = useState<RowState[]>([]);
  const [pastedJson, setPastedJson] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [persistReviewedTranscript, setPersistReviewedTranscript] = useState(true);

  useEffect(() => {
    if (!visible) return;

    setStep(initialStep);
    setPastedJson("");
    setIsSaving(false);
    setNotice(null);
    setPersistReviewedTranscript(true);
    setRows(
      initialWords.map((w) => ({
        id: w.id,
        original_text: w.text.trim(),
        canonical_form: "",
        explanation: "",
      }))
    );
  }, [visible, initialWords, initialStep]);

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

  const handleCopyPrompt = async () => {
    const result = await onCopyPrompt();
    const nextNotice: Notice = {
      tone: result.ok ? "success" : "error",
      text: result.message,
    };
    updateNotice(nextNotice);
    if (result.ok) {
      setStep("paste_json");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-card shadow-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">
              {step === "review_words" && t("reviewSelectionTitle")}
              {step === "paste_json" && t("pasteJsonTitle")}
              {step === "review_ai" && t("reviewDefinitionsTitle")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "review_words" && t("reviewSelectionDesc")}
              {step === "paste_json" && t("pasteJsonDesc")}
              {step === "review_ai" && t("reviewDefinitionsDesc")}
            </p>
          </div>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            {t("close")}
          </Button>
        </div>

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

        <div className="flex-1 overflow-y-auto p-6 bg-muted/10 custom-scrollbar">
          {rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              {t("noVocabularySelected")}
            </div>
          ) : step === "paste_json" ? (
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
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder={t("pasteJsonPlaceholder")}
                  className="min-h-[280px] w-full rounded-lg border border-input bg-background px-3 py-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar"
                />
              </div>
            </div>
          ) : (
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

        <div className="px-6 py-4 border-t border-border shrink-0 bg-muted/20 flex gap-3 justify-end items-center">
          {step === "review_words" && rows.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setStep("paste_json")}>
                {t("goToPasteJson")}
              </Button>
              <Button onClick={handleCopyPrompt} className="gap-2">
                <Copy className="h-4 w-4" />
                {t("copyPrompt")}
              </Button>
            </>
          )}

          {step === "paste_json" && (
            <>
              <Button variant="outline" onClick={() => setStep("review_words")}>
                {t("backToSelection")}
              </Button>
              <Button variant="outline" onClick={handleCopyPrompt} className="gap-2">
                <Copy className="h-4 w-4" />
                {t("copyPrompt")}
              </Button>
              <Button onClick={handleApplyJson} disabled={!pastedJson.trim()} className="gap-2">
                <FileJson className="h-4 w-4" />
                {t("applyJson")}
              </Button>
            </>
          )}

          {step === "review_ai" && (
            <>
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
              <Button variant="outline" onClick={() => setStep("paste_json")} disabled={isSaving}>
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
