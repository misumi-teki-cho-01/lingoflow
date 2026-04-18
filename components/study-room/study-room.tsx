"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { useTranscriptSync } from "@/hooks/use-transcript-sync";
import { useVocabularyReview } from "@/hooks/use-vocabulary-review";
import { VideoControls } from "@/components/video/video-controls";
import { TranscriptPanel } from "@/components/transcript/transcript-panel";
import { FillPanel } from "@/components/fill/fill-panel";
import { EchoEditor } from "@/components/scribe/echo-editor";
import { VocabularyReviewModal } from "./vocabulary-review-modal";
import { SubtitleEnhanceModal } from "./subtitle-enhance-modal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { stripPunctuation } from "@/lib/utils/format";
import {
  convertToMarkdown,
  convertTranscriptToMarkdown,
  convertTranscriptToMarkdownWithHighlights,
  downloadMarkdown,
  type ExportMetadata,
} from "@/lib/utils/markdown";
import { saveEnhancedTranscript } from "@/lib/api/transcripts";
import type { TranscriptSegment, CcSelection, DragState } from "@/types/transcript";
import type { TranscriptSource } from "@/lib/pipeline/transcription-pipeline";
import type { YouTubeMeta } from "@/lib/utils/youtube-meta";
import type { VocabularyExplanation } from "@/lib/ai/services";
import {
  ChevronLeft,
  Headphones,
  Captions,
  PenLine,
  Download,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  TriangleAlert,
  Wand2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
export type StudyMode = "scribe" | "cc" | "fill";

export interface StudyRoomProps {
  videoId: string;
  videoMeta: YouTubeMeta;
  videoUrl: string;
  segments: TranscriptSegment[];
  initialDefinitions?: Record<string, VocabularyExplanation>;
  initialDictationHtml?: string | null;
  transcriptSource?: TranscriptSource;
  transcriptError?: string;
  defaultMode?: StudyMode;
}

type FeedbackState = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

// ── Helpers ────────────────────────────────────────────────────────────────
function pushModeToUrl(mode: StudyMode) {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url.toString());
}

// ── Component ──────────────────────────────────────────────────────────────
export function StudyRoom({
  videoId,
  videoMeta,
  videoUrl,
  segments: initialSegments,
  initialDefinitions = {},
  initialDictationHtml = null,
  transcriptSource,
  transcriptError,
  defaultMode = "scribe",
}: StudyRoomProps) {
  const t = useTranslations("studyRoom");
  const locale = useLocale();

  const [mode, setMode] = useState<StudyMode>(defaultMode);
  const [showCC, setShowCC] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((next: FeedbackState) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(next);
    if (next?.tone === "success") {
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
    }
  }, []);

  // Live segments (can be updated after AI enhancement)
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>(initialSegments);

  // CC mode — position-based selections + drag state
  const [ccSelections, setCcSelections] = useState<CcSelection[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Derived: set of "segIdx-wordIdx" keys for fast per-instance highlight lookup
  const selectedPositionKeys = useMemo(() => {
    const keys = new Set<string>();
    ccSelections.forEach((sel) => {
      for (let i = sel.startWordIndex; i <= sel.endWordIndex; i++) {
        keys.add(`${sel.segmentIndex}-${i}`);
      }
    });
    return keys;
  }, [ccSelections]);

  // ── CC selection persistence ──────────────────────────────────────────────
  const CC_STORAGE_KEY = `cc-selections-${videoId}`;

  // Load saved selections on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CC_STORAGE_KEY);
      if (saved) setCcSelections(JSON.parse(saved));
    } catch { /* ignore corrupt data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CC_STORAGE_KEY]);

  // Save on every change (debounced 500 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(ccSelections));
    }, 500);
    return () => clearTimeout(timer);
  }, [ccSelections, CC_STORAGE_KEY]);

  // Enhancement modal
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);

  // Vocabulary review (shared hook)
  const {
    showReviewModal,
    selectedWords,
    reviewStep,
    definitions,
    openReview,
    closeReview,
    setDefinitions,
  } = useVocabularyReview(initialDefinitions);

  // ── Player ────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useVideoPlayer({ containerRef, videoUrl });
  const { activeSegment, activeSegmentIndex } = useTranscriptSync(
    liveSegments,
    player.currentTime
  );

  // ── Editor ref ────────────────────────────────────────────────────────────
  const editorRef = useRef<import("@/components/scribe/echo-editor").EchoEditorHandle>(null);

  // ── Stable player refs (for keyboard handler) ─────────────────────────────
  const playerPauseRef = useRef(player.pause);
  playerPauseRef.current = player.pause;
  const playerPlayRef = useRef(player.play);
  playerPlayRef.current = player.play;

  // ── Shared export metadata ─────────────────────────────────────────────────
  const exportMeta = useMemo((): ExportMetadata => ({
    title: videoMeta.title || `YouTube · ${videoId}`,
    url: videoUrl,
    channelName: videoMeta.channelName || undefined,
    date: new Date().toLocaleDateString(),
  }), [videoMeta, videoId, videoUrl]);

  // ── Mode change ───────────────────────────────────────────────────────────
  const handleModeChange = useCallback((next: StudyMode) => {
    setMode(next);
    pushModeToUrl(next);
    // Clear CC selections only when switching away from both cc and fill modes
    if (next !== "cc" && next !== "fill") {
      setCcSelections([]);
      setDragState(null);
    }
  }, []);

  // ── Global keyboard shortcuts (Scribe mode only) ───────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "scribe") return;

      const target = e.target as HTMLElement;
      const isEditor = target.contentEditable === "true";
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Enter" && !isEditor && !isInput) {
        e.preventDefault();
        playerPauseRef.current();
        document.querySelector<HTMLElement>(".ProseMirror")?.focus();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const safeName = (videoMeta.title || videoId).replace(/[^a-z0-9]/gi, "_").toLowerCase();

    if (mode === "scribe") {
      const html = editorRef.current?.getHtml() ?? "";
      const md = convertToMarkdown(html, exportMeta);
      downloadMarkdown(md, `EchoScribe_${safeName}.md`);
    } else {
      const md = convertTranscriptToMarkdown(liveSegments, exportMeta);
      downloadMarkdown(md, `Transcript_${safeName}.md`);
    }
  };

  // ── Context text providers (for VocabularyReviewModal) ────────────────────
  const getScribeContextText = useCallback(async (): Promise<string> => {
    const html = editorRef.current?.getHtml() ?? "";
    return convertToMarkdown(html, exportMeta);
  }, [exportMeta]);

  const getCCContextText = useCallback(async (): Promise<string> => {
    return convertTranscriptToMarkdownWithHighlights(liveSegments, exportMeta, ccSelections);
  }, [liveSegments, exportMeta, ccSelections]);

  // ── CC drag selection ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((segIdx: number, wordIdx: number) => {
    setDragState({ segmentIndex: segIdx, startIdx: wordIdx, currentIdx: wordIdx });
  }, []);

  const handleDragEnter = useCallback((segIdx: number, wordIdx: number) => {
    setDragState((prev) =>
      prev?.segmentIndex === segIdx ? { ...prev, currentIdx: wordIdx } : prev
    );
  }, []);

  const handleDragEnd = useCallback(() => {
    // Read dragState directly from closure (it's in deps) — no nested setState
    if (!dragState) return;

    const { segmentIndex, startIdx, currentIdx } = dragState;
    const minIdx = Math.min(startIdx, currentIdx);
    const maxIdx = Math.max(startIdx, currentIdx);

    const seg = liveSegments[segmentIndex];
    const nonWhitespaceTokens = seg.text.split(/(\s+)/).filter((t) => !/^\s+$/.test(t));
    // Strip leading/trailing punctuation from each token so "world." → "world"
    const phrase = nonWhitespaceTokens
      .slice(minIdx, maxIdx + 1)
      .map(stripPunctuation)
      .filter(Boolean)
      .join(" ");

    const id =
      minIdx === maxIdx
        ? `${segmentIndex}-${minIdx}`
        : `${segmentIndex}-${minIdx}-${maxIdx}`;

    // Clear drag state first so double-fire is a no-op
    setDragState(null);

    setCcSelections((prevSels) => {
      const overlaps = prevSels.filter(
        (s) =>
          s.segmentIndex === segmentIndex &&
          s.startWordIndex <= maxIdx &&
          s.endWordIndex >= minIdx
      );
      if (overlaps.length > 0) {
        return prevSels.filter((s) => !overlaps.includes(s));
      }
      return [
        ...prevSels,
        { id, segmentIndex, startWordIndex: minIdx, endWordIndex: maxIdx, text: phrase },
      ];
    });
  }, [dragState, liveSegments]);

  const handleCCWordsClear = useCallback(() => {
    setCcSelections([]);
    localStorage.removeItem(`cc-selections-${videoId}`);
  }, [videoId]);

  // ── Vocabulary review — Scribe ────────────────────────────────────────────
  const openScribeVocabularyReview = () => {
    if (!editorRef.current) return;
    const words = editorRef.current.getHighlightedWords();
    if (words.length === 0) {
      showFeedback({ tone: "error", text: t("noVocabularySelected") });
      return;
    }
    openReview(words);
  };

  // ── Vocabulary review — CC ─────────────────────────────────────────────────
  const openCCVocabularyReview = useCallback(() => {
    if (ccSelections.length === 0) return;
    const words = ccSelections.map((sel) => ({ id: sel.id, text: sel.text }));
    openReview(words);
  }, [ccSelections, openReview]);

  // ── Save vocabulary — Scribe ──────────────────────────────────────────────
  const handleSaveScribeVocabulary = async (
    finalData: Record<string, VocabularyExplanation>,
    transforms: { id: string; newText: string }[],
    options: { persistReviewedTranscript: boolean }
  ) => {
    const { saveVocabularyToDB } = await import("@/lib/api/ai");
    await saveVocabularyToDB(videoId, finalData, {
      sourceMode: "scribe",
      dictation: options.persistReviewedTranscript
        ? {
            contentHtml: editorRef.current?.getHtml() ?? "",
            segments: editorRef.current?.getTranscriptSegments() ?? [],
          }
        : undefined,
    });

    if (editorRef.current && transforms.length > 0) {
      transforms.forEach((tr) => {
        editorRef.current!.updateHighlightedWord(tr.id, tr.newText);
      });
    }

    setDefinitions((prev) => ({ ...prev, ...finalData }));
    showFeedback({ tone: "success", text: t("saveSuccess") });
    closeReview();
  };

  // ── Save vocabulary — CC ──────────────────────────────────────────────────
  const handleSaveCCVocabulary = async (
    finalData: Record<string, VocabularyExplanation>,
    _transforms: { id: string; newText: string }[],
    _options: { persistReviewedTranscript: boolean }
  ) => {
    const { saveVocabularyToDB } = await import("@/lib/api/ai");
    await saveVocabularyToDB(videoId, finalData, { sourceMode: "cc" });
    setDefinitions((prev) => ({ ...prev, ...finalData }));
    // Keep selections visible — words now show their definitions on click
    showFeedback({ tone: "success", text: t("saveSuccess") });
    closeReview();
  };

  // ── Save enhanced subtitles ───────────────────────────────────────────────
  const handleSaveEnhancedTranscript = async (enhanced: TranscriptSegment[]) => {
    await saveEnhancedTranscript(videoId, enhanced);
    setLiveSegments(enhanced);
    setShowEnhanceModal(false);
    showFeedback({ tone: "success", text: t("enhanceSaveSuccess") });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-2 shrink-0 bg-card/50 backdrop-blur-md">
        {/* Back */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("back")}
        </Link>

        <span className="text-xs text-muted-foreground" aria-hidden>·</span>

        {/* Title */}
        <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] lg:max-w-md" title={videoMeta.title || videoId}>
          {videoMeta.title || videoId}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex items-center rounded-full border border-border bg-muted/30 p-0.5 text-xs">
          <button
            onClick={() => handleModeChange("scribe")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all font-medium ${mode === "scribe"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Headphones className="h-3.5 w-3.5" />
            {t("echoScribeMode")}
            {mode === "scribe" && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/70 animate-pulse" aria-hidden />
            )}
          </button>
          <button
            onClick={() => handleModeChange("cc")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all font-medium ${mode === "cc"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Captions className="h-3.5 w-3.5" />
            {t("ccMode")}
          </button>
          <button
            onClick={() => handleModeChange("fill")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all font-medium ${mode === "fill"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <PenLine className="h-3.5 w-3.5" />
            {t("fillMode")}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {mode === "scribe" && (
            <Button
              variant="outline"
              size="sm"
              onClick={openScribeVocabularyReview}
              className="h-8 gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("aiExplain")}
            </Button>
          )}

          {mode === "cc" && (
            <>
              {ccSelections.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCCVocabularyReview}
                  className="h-8 gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("aiExplain")} ({ccSelections.length})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEnhanceModal(true)}
                className="h-8 gap-1.5 text-xs text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 border-violet-200 dark:border-violet-500/30"
              >
                <Wand2 className="h-3.5 w-3.5" />
                {t("enhanceSubtitles")}
              </Button>
            </>
          )}

          {mode === "fill" && ccSelections.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={openCCVocabularyReview}
              className="h-8 gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("aiExplain")} ({ccSelections.length})
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            {t("exportMd")}
          </Button>
        </div>
      </header>

      {/* ── Feedback banner ── */}
      {feedback && (
        <div className="px-4 pt-3 shrink-0">
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
              feedback.tone === "success"
                ? "border-emerald-300/70 bg-emerald-50 text-emerald-700"
                : feedback.tone === "error"
                  ? "border-red-300/70 bg-red-50 text-red-700"
                  : "border-sky-300/70 bg-sky-50 text-sky-700"
            }`}
          >
            {feedback.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 overflow-hidden">

        {/* Left — video + controls + (Scribe only: CC overlay + hints) */}
        <section className="flex flex-col p-4 gap-3 min-h-0 border-r border-border/50 overflow-hidden">

          {/* Video info bar */}
          {(videoMeta.title || videoMeta.channelName) && (
            <div className="shrink-0 px-1">
              {videoMeta.title && (
                <h1 className="text-sm font-semibold leading-tight line-clamp-1">{videoMeta.title}</h1>
              )}
              {videoMeta.channelName && (
                <p className="text-xs text-muted-foreground mt-0.5">{videoMeta.channelName}</p>
              )}
            </div>
          )}

          {/* Player */}
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg ring-1 ring-white/10 shrink-0">
            <div ref={containerRef} className="h-full w-full" />
          </div>

          {/* Controls */}
          <VideoControls player={player} />

          {/* Scribe-mode extras */}
          {mode === "scribe" && (
            <>
              {/* CC overlay (toggleable) */}
              <div
                className={`rounded-xl border border-dashed border-border p-4 flex flex-col items-center justify-center text-center min-h-[80px] transition-all duration-300 ${showCC ? "bg-card opacity-100" : "bg-muted/5 opacity-40"
                  }`}
              >
                {!showCC ? (
                  <p className="text-xs text-muted-foreground">{t("ccHidden")}</p>
                ) : activeSegment ? (
                  <p className="text-base font-medium leading-relaxed animate-in fade-in">
                    {activeSegment.text}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t("ccNoSubtitle")}</p>
                )}
              </div>

              {/* Shortcut legends + CC toggle */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Enter</kbd>
                    {t("shortcutPause")}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Shift+Enter</kbd>
                    {t("shortcutResume")}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCC((v) => !v)}
                  className="h-7 text-xs gap-1 px-2"
                >
                  {showCC ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showCC ? t("hideCC") : t("showCC")}
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Right — mode-specific panel */}
        <section className="p-4 flex flex-col min-h-0 overflow-hidden">
          {mode === "scribe" ? (
            <EchoEditor
              ref={editorRef}
              className="flex-1 min-h-0"
              onCommit={() => playerPlayRef.current()}
              currentTime={player.currentTime}
              draftKey={videoId}
              initialContent={initialDictationHtml}
              definitions={definitions}
            />
          ) : mode === "cc" ? (
            <TranscriptPanel
              segments={liveSegments}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentClick={player.seekTo}
              source={transcriptSource}
              errorMessage={transcriptError}
              wordClickMode
              selectedPositionKeys={selectedPositionKeys}
              selectionCount={ccSelections.length}
              definitions={definitions}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onClearWords={handleCCWordsClear}
              onExplainWords={openCCVocabularyReview}
            />
          ) : (
            <FillPanel
              segments={liveSegments}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentClick={player.seekTo}
              errorMessage={transcriptError}
              selectedPositionKeys={selectedPositionKeys}
              selectionCount={ccSelections.length}
              definitions={definitions}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onClearWords={handleCCWordsClear}
              onExplainWords={openCCVocabularyReview}
            />
          )}
        </section>

      </main>

      {/* ── Vocabulary Review Modal ── */}
      <VocabularyReviewModal
        visible={showReviewModal}
        initialWords={selectedWords}
        initialStep={reviewStep}
        onCancel={closeReview}
        onSave={mode === "scribe" ? handleSaveScribeVocabulary : handleSaveCCVocabulary}
        getContextText={mode === "scribe" ? getScribeContextText : getCCContextText}
        showPersistOption={mode === "scribe"}
        onFeedback={showFeedback}
      />

      {/* ── Subtitle Enhancement Modal ── */}
      <SubtitleEnhanceModal
        visible={showEnhanceModal}
        segments={liveSegments}
        onCancel={() => setShowEnhanceModal(false)}
        onSave={handleSaveEnhancedTranscript}
      />
    </div>
  );
}
