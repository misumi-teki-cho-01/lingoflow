"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { useTranscriptSync } from "@/hooks/use-transcript-sync";
import { VideoControls } from "@/components/video/video-controls";
import { TranscriptPanel } from "@/components/transcript/transcript-panel";
import { EchoEditor, type EchoEditorHandle } from "@/components/scribe/echo-editor";
import { ConfirmExplainModal } from "./confirm-explain-modal";
import { fetchAIExplanations } from "@/lib/api/explain";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  convertToMarkdown,
  convertTranscriptToMarkdown,
  downloadMarkdown,
  type ExportMetadata,
} from "@/lib/utils/markdown";
import type { TranscriptSegment } from "@/types/transcript";
import type { TranscriptSource } from "@/lib/pipeline/transcription-pipeline";
import type { YouTubeMeta } from "@/lib/utils/youtube-meta";
import {
  ChevronLeft,
  Headphones,
  Captions,
  Download,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
export type StudyMode = "scribe" | "cc";

export interface StudyRoomProps {
  videoId: string;
  videoMeta: YouTubeMeta;
  videoUrl: string;
  segments: TranscriptSegment[];
  transcriptSource?: TranscriptSource;
  transcriptError?: string;
  defaultMode?: StudyMode;
}

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
  segments,
  transcriptSource,
  transcriptError,
  defaultMode = "scribe",
}: StudyRoomProps) {
  const t = useTranslations("studyRoom");
  const locale = useLocale();

  const [mode, setMode] = useState<StudyMode>(defaultMode);
  const [showCC, setShowCC] = useState(false);

  // AI Definition state
  const [isExplaining, setIsExplaining] = useState(false);
  const [showExplainConfirm, setShowExplainConfirm] = useState(false);
  const [definitions, setDefinitions] = useState<Record<string, string>>({});

  // ── Player ────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useVideoPlayer({ containerRef, videoUrl });
  const { activeSegment, activeSegmentIndex } = useTranscriptSync(
    segments,
    player.currentTime
  );

  // ── Editor ref ────────────────────────────────────────────────────────────
  const editorRef = useRef<EchoEditorHandle>(null);

  // ── Stable player refs (for keyboard handler) ─────────────────────────────
  const playerPauseRef = useRef(player.pause);
  playerPauseRef.current = player.pause;
  const playerPlayRef = useRef(player.play);
  playerPlayRef.current = player.play;

  // ── Mode change ───────────────────────────────────────────────────────────
  const handleModeChange = useCallback((next: StudyMode) => {
    setMode(next);
    pushModeToUrl(next);
  }, []);

  // ── Global keyboard shortcuts (Scribe mode only) ───────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "scribe") return;

      const target = e.target as HTMLElement;
      const isEditor = target.contentEditable === "true";
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Enter (outside editor) → pause + focus editor
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
    const meta: ExportMetadata = {
      title: videoMeta.title || `YouTube · ${videoId}`,
      url: videoUrl,
      channelName: videoMeta.channelName || undefined,
      date: new Date().toLocaleDateString(),
    };
    const safeName = (videoMeta.title || videoId).replace(/[^a-z0-9]/gi, "_").toLowerCase();

    if (mode === "scribe") {
      const html = editorRef.current?.getHtml() ?? "";
      const md = convertToMarkdown(html, meta);
      downloadMarkdown(md, `EchoScribe_${safeName}.md`);
    } else {
      const md = convertTranscriptToMarkdown(segments, meta);
      downloadMarkdown(md, `Transcript_${safeName}.md`);
    }
  };

  const handleExplainConfirm = async () => {
    setShowExplainConfirm(false);
    setIsExplaining(true);
    try {
      const html = editorRef.current?.getHtml() ?? "";
      const meta: ExportMetadata = {
        title: videoMeta.title || `YouTube · ${videoId}`,
        url: videoUrl,
        channelName: videoMeta.channelName || undefined,
        date: new Date().toLocaleDateString(),
      };
      
      const md = convertToMarkdown(html, meta);
      const definitionsMap = await fetchAIExplanations(md, locale);
      setDefinitions(definitionsMap);
      
    } catch (e: any) {
      console.error("[Explain AI] Error:", e);
      alert(t("error") + " - " + e.message);
    } finally {
      setIsExplaining(false);
    }
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
        </div>

        {/* Export and AI Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {mode === "scribe" && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowExplainConfirm(true)} 
              disabled={isExplaining}
              className="h-8 gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
            >
              {isExplaining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isExplaining ? t("explaining") : t("aiExplain")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            {t("exportMd")}
          </Button>
        </div>
      </header>

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
              definitions={definitions}
            />
          ) : (
            <TranscriptPanel
              segments={segments}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentClick={player.seekTo}
              source={transcriptSource}
              errorMessage={transcriptError}
            />
          )}
        </section>

      </main>

      {/* AI Explanation Confirmation Modal */}
      <ConfirmExplainModal
        visible={showExplainConfirm}
        title={t("confirmExplainTitle")}
        description={t("confirmExplainDesc")}
        cancelText={t("confirmExplainCancel")}
        submitText={t("confirmExplainSubmit")}
        onCancel={() => setShowExplainConfirm(false)}
        onSubmit={handleExplainConfirm}
      />
    </div>
  )
};
