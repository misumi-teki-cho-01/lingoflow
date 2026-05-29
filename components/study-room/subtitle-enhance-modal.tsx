'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { JsonValidationBadge } from '@/components/ui/json-validation-badge';
import {
  CheckCircle2,
  ChevronLeft,
  Cpu,
  Copy,
  Languages,
  Loader2,
  Save,
  Sparkles,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { getEnhancementPrompt } from '@/lib/ai/prompts';
import { reconstructSegmentsFromGroupings } from '@/lib/ai/services';
import { fetchAIEnhancement } from '@/lib/api/ai';
import { useJsonValidation } from '@/hooks/use-json-validation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from '@/lib/ai/client';
import type { TranscriptSegment } from '@/types/transcript';

const PROMPT_LANGUAGE_KEY = 'lingo-prompt-language';
const MODEL_ID_KEY = 'lingo-ai-model-id';

const LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];

type Mode = 'manual' | 'auto';
type Step = 'manual_prompt' | 'manual_paste' | 'auto_config' | 'auto_running' | 'preview';

type Notice = {
  tone: 'success' | 'error';
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
  const numbered = segments.map((s, idx) => ({ id: idx + 1, text: s.text }));
  return `${getEnhancementPrompt(lang)}\n\nTranscript:\n${JSON.stringify(numbered, null, 2)}`;
}

export function SubtitleEnhanceModal({
  visible,
  segments,
  rawSegments,
  onCancel,
  onSave,
}: SubtitleEnhanceModalProps) {
  const t = useTranslations('studyRoom');
  const locale = useLocale();

  // Mode: default to manual every time (NOT persisted)
  const [mode, setMode] = useState<Mode>('manual');
  // "current" = already-enhanced liveSegments; "raw" = original YouTube subtitles
  const [sourceMode, setSourceMode] = useState<'current' | 'raw'>('current');
  const [step, setStep] = useState<Step>('manual_prompt');
  const [editablePrompt, setEditablePrompt] = useState('');
  const [pastedJson, setPastedJson] = useState('');
  const [enhancedSegments, setEnhancedSegments] = useState<TranscriptSegment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptLanguage, setPromptLanguage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PROMPT_LANGUAGE_KEY) || locale;
    }
    return locale;
  });
  const [modelId, setModelId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(MODEL_ID_KEY) || DEFAULT_MODEL_ID;
    }
    return DEFAULT_MODEL_ID;
  });
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const jsonValidation = useJsonValidation(step === 'manual_paste' ? pastedJson : '', 'segments');

  // Apply auto-corrected text back to the textarea when the hook fixes it
  useEffect(() => {
    if (jsonValidation.correctedText !== null) {
      setPastedJson(jsonValidation.correctedText);
    }
  }, [jsonValidation.correctedText]);

  useEffect(() => {
    if (!visible) return;
    setMode('manual');
    setStep('manual_prompt');
    setSourceMode('current');
    const saved = typeof window !== 'undefined' ? localStorage.getItem(PROMPT_LANGUAGE_KEY) : null;
    const lang = saved || locale;
    setPromptLanguage(lang);
    setEditablePrompt(buildEnhancePrompt(segments, lang));
    setPastedJson('');
    setEnhancedSegments([]);
    setIsSaving(false);
    setIsRunning(false);
    setNotice(null);
    setPromptCopied(false);
  }, [visible, segments, locale]);

  const activeSegments = sourceMode === 'raw' && rawSegments ? rawSegments : segments;

  const handleModeChange = (next: Mode) => {
    if (isRunning || isSaving) return;
    setMode(next);
    setStep(next === 'manual' ? 'manual_prompt' : 'auto_config');
    setNotice(null);
    setPastedJson('');
  };

  const handleLanguageChange = (lang: string) => {
    setPromptLanguage(lang);
    localStorage.setItem(PROMPT_LANGUAGE_KEY, lang);
    setEditablePrompt(buildEnhancePrompt(activeSegments, lang));
  };

  const handleModelChange = (next: string) => {
    setModelId(next);
    localStorage.setItem(MODEL_ID_KEY, next);
  };

  const handleSourceModeChange = (next: 'current' | 'raw') => {
    setSourceMode(next);
    const src = next === 'raw' && rawSegments ? rawSegments : segments;
    setEditablePrompt(buildEnhancePrompt(src, promptLanguage));
  };

  if (!visible) return null;

  const handleCopyAndContinue = async () => {
    try {
      await navigator.clipboard.writeText(editablePrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
      setNotice({ tone: 'success', text: t('promptCopiedToast') });
      setStep('manual_paste');
    } catch {
      setNotice({ tone: 'error', text: t('copyPromptFailed') });
    }
  };

  const handleApplyJson = () => {
    const result = reconstructSegmentsFromGroupings(activeSegments, pastedJson);
    if (!result.ok) {
      setNotice({
        tone: 'error',
        text: t('enhanceGroupingInvalid', { reason: result.error }),
      });
      return;
    }
    setEnhancedSegments(result.segments);
    setStep('preview');
    setNotice(null);
  };

  const handleRunAuto = async () => {
    setIsRunning(true);
    setNotice(null);
    setStep('auto_running');
    try {
      const result = await fetchAIEnhancement(activeSegments, promptLanguage, modelId);
      if (!result || result.length === 0) {
        setNotice({ tone: 'error', text: t('enhanceAutoEmpty') });
        setStep('auto_config');
        return;
      }
      setEnhancedSegments(result);
      setStep('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('enhanceAutoFailed');
      setNotice({ tone: 'error', text: msg });
      setStep('auto_config');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(enhancedSegments);
    } catch {
      setNotice({ tone: 'error', text: t('saveFailed') });
    } finally {
      setIsSaving(false);
    }
  };

  const stepTitle = {
    manual_prompt: t('enhancePromptTitle'),
    manual_paste: t('enhancePasteTitle'),
    auto_config: t('enhanceAutoConfigTitle'),
    auto_running: t('enhanceAutoRunningTitle'),
    preview: t('enhancePreviewTitle'),
  }[step];

  const stepDesc = {
    manual_prompt: t('enhancePromptDesc'),
    manual_paste: t('enhancePasteDesc'),
    auto_config: t('enhanceAutoConfigDesc', { count: activeSegments.length }),
    auto_running: t('enhanceAutoRunningDesc'),
    preview: t('enhancePreviewDesc', {
      from: segments.length,
      to: enhancedSegments.length,
    }),
  }[step];

  const noticeClass =
    notice?.tone === 'success'
      ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700'
      : 'border-red-300/70 bg-red-50 text-red-700';

  // Mode toggle is shown only on the entry screen of each flow.
  const showModeToggle = step === 'manual_prompt' || step === 'auto_config';

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
          <Button variant="outline" onClick={onCancel} disabled={isSaving || isRunning}>
            {t('close')}
          </Button>
        </div>

        {/* Notice */}
        {notice && (
          <div
            className={`mx-6 mt-4 rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${noticeClass}`}
          >
            {notice.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10 custom-scrollbar">
          {/* ── Mode toggle (entry screens only) ── */}
          {showModeToggle && (
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm font-medium shrink-0">{t('enhanceModeLabel')}</span>
              <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-0.5">
                {(['manual', 'auto'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      mode === m
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m === 'manual' ? t('enhanceModeManual') : t('enhanceModeAuto')}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {mode === 'manual' ? t('enhanceModeManualHint') : t('enhanceModeAutoHint')}
              </span>
            </div>
          )}

          {/* ── Shared config (source + language) ── */}
          {(step === 'manual_prompt' || step === 'auto_config') && (
            <div className="space-y-4">
              {/* Source selector — only shown when raw segments are available */}
              {rawSegments && rawSegments.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 px-3 py-2">
                  <span className="text-sm font-medium shrink-0 text-amber-700 dark:text-amber-400">
                    {t('enhanceSource')}
                  </span>
                  <div className="flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-700 bg-background p-0.5">
                    {(['current', 'raw'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => handleSourceModeChange(m)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          sourceMode === m
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {m === 'current' ? t('enhanceSourceCurrent') : t('enhanceSourceRaw')}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-amber-600 dark:text-amber-500">
                    {sourceMode === 'raw'
                      ? t('enhanceSourceRawHint', { count: rawSegments.length })
                      : t('enhanceSourceCurrentHint', {
                          count: segments.length,
                        })}
                  </span>
                </div>
              )}

              {/* Language selector */}
              <div className="flex items-center gap-3">
                <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium shrink-0">{t('promptLanguage')}</span>
                <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-0.5">
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleLanguageChange(opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        promptLanguage === opt.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual: editable prompt */}
              {step === 'manual_prompt' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('promptEditableLabel')}</label>
                  <textarea
                    value={editablePrompt}
                    onChange={(e) => setEditablePrompt(e.target.value)}
                    className="min-h-[380px] w-full rounded-lg border border-input bg-background px-3 py-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar"
                  />
                </div>
              )}

              {/* Auto: model picker */}
              {step === 'auto_config' && (
                <>
                  <div className="flex items-center gap-3">
                    <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium shrink-0">{t('enhanceModelLabel')}</span>
                    <Select<string>
                      value={modelId}
                      onValueChange={(v) => v && handleModelChange(v)}
                    >
                      <SelectTrigger className="min-w-[220px]">
                        <SelectValue>
                          {MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="flex flex-col">
                              <span>{m.label}</span>
                              {m.hint && (
                                <span className="text-xs text-muted-foreground">{m.hint}</span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800/40 px-4 py-3 text-sm text-violet-700 dark:text-violet-300 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{t('enhanceAutoHint', { count: activeSegments.length })}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'manual_paste' && (
            <div className="space-y-2">
              <label htmlFor="enhance-json" className="text-sm font-medium">
                {t('enhancePasteLabel')}
              </label>
              <textarea
                id="enhance-json"
                ref={pasteTextareaRef}
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder={'[{"ids": [1, 2, 3], "text": "..."}]'}
                className={`min-h-[300px] w-full rounded-lg border bg-background px-3 py-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 custom-scrollbar transition-colors ${
                  jsonValidation.status === 'invalid'
                    ? 'border-red-400 focus-visible:ring-red-400'
                    : jsonValidation.status === 'valid'
                      ? 'border-emerald-400 focus-visible:ring-emerald-400'
                      : 'border-input focus-visible:ring-ring'
                }`}
              />
              <JsonValidationBadge
                validation={jsonValidation}
                onJump={() => jsonValidation.jumpToError(pasteTextareaRef.current)}
                validLabel={t('enhanceGroupingsValid', {
                  count: jsonValidation.itemCount ?? 0,
                })}
              />
            </div>
          )}

          {step === 'auto_running' && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm font-medium">{t('enhanceAutoRunningTitle')}</p>
              <p className="text-xs">{t('enhanceAutoRunningDesc')}</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                {t('enhancePreviewDesc', {
                  from: segments.length,
                  to: enhancedSegments.length,
                })}
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
                        <td
                          colSpan={2}
                          className="px-4 py-3 text-xs text-center text-muted-foreground"
                        >
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
          {step === 'manual_prompt' && (
            <Button
              onClick={handleCopyAndContinue}
              disabled={!editablePrompt.trim()}
              className="gap-2"
            >
              {promptCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {t('copyAndContinue')}
            </Button>
          )}

          {step === 'manual_paste' && (
            <>
              <Button variant="outline" onClick={() => setStep('manual_prompt')} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                {t('backToPromptEditor')}
              </Button>
              <Button onClick={handleApplyJson} disabled={!pastedJson.trim()} className="gap-2">
                {t('applyJson')}
              </Button>
            </>
          )}

          {step === 'auto_config' && (
            <Button onClick={handleRunAuto} disabled={isRunning} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {t('enhanceAutoRun')}
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(mode === 'manual' ? 'manual_paste' : 'auto_config')}
                disabled={isSaving}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                {mode === 'manual' ? t('backToPasteJson') : t('backToAutoConfig')}
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? t('saving') : t('saveToDb')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
