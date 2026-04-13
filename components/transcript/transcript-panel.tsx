"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollText, Search, MousePointerClick, X, Check, Sparkles } from "lucide-react";
import { TranscriptSegmentRow } from "./transcript-segment";
import type { TranscriptSegment } from "@/types/transcript";
import type { TranscriptSource } from "@/lib/pipeline/transcription-pipeline";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  activeSegmentIndex: number;
  onSegmentClick: (time: number) => void;
  source?: TranscriptSource;
  isLoading?: boolean;
  errorMessage?: string;
  wordClickMode?: boolean;
  selectedWords?: Set<string>;
  onWordClick?: (word: string) => void;
  onExplainWords?: () => void;
  onClearWords?: () => void;
}

export function TranscriptPanel({
  segments,
  activeSegmentIndex,
  onSegmentClick,
  source,
  isLoading = false,
  errorMessage,
  wordClickMode = false,
  selectedWords,
  onWordClick,
  onExplainWords,
  onClearWords,
}: TranscriptPanelProps) {
  const t = useTranslations("transcript");

  const [searchQuery, setSearchQuery] = useState("");
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Source badge labels — keyed from i18n
  const SOURCE_LABELS: Record<TranscriptSource, { label: string; variant: "default" | "secondary" | "outline" }> = {
    "subtitle-enhanced": { label: t("sourceEnhanced"), variant: "default" },
    "subtitle-raw":      { label: t("sourceRaw"),      variant: "secondary" },
    "audio-transcribed": { label: t("sourceAudio"),    variant: "default" },
    "failed":            { label: t("sourceFailed"),   variant: "outline" },
  };

  // Filter segments based on search query
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchQuery]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentIndex < 0 || !isAutoScrollEnabled) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSegmentIndex, isAutoScrollEnabled]);

  const selectedCount = selectedWords?.size ?? 0;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // ── Empty / error state ────────────────────────────────────────────────────
  if (errorMessage || segments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <div className="rounded-full bg-muted p-5">
          <ScrollText className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <div className="max-w-[200px]">
          <p className="font-semibold">
            {errorMessage ? t("fetchFailed") : t("noSubtitles")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {errorMessage ?? t("noSubtitlesDesc")}
          </p>
        </div>
      </div>
    );
  }

  // ── Main panel ─────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-col border-b border-border bg-muted/30 p-3 pb-0">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-tight">{t("title")}</h3>
            {source && source !== "failed" && (
              <Badge
                variant={SOURCE_LABELS[source].variant}
                className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wider"
              >
                {SOURCE_LABELS[source].label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {wordClickMode && selectedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground"
                onClick={onClearWords}
              >
                {t("clearSelection")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 transition-colors ${
                isAutoScrollEnabled
                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                  : "text-muted-foreground"
              }`}
              onClick={() => setIsAutoScrollEnabled((v) => !v)}
              title={t("autoScroll")}
            >
              <MousePointerClick className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {wordClickMode && (
          <div className="mb-3 px-1 text-xs text-muted-foreground">
            {t("wordClickHint")}
          </div>
        )}

        {/* Search bar — hidden in word click mode to keep UI focused */}
        {!wordClickMode && (
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-8 pl-8 pr-7 text-xs bg-background/50 border-none ring-1 ring-border focus-visible:ring-primary/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable segment list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-2 py-2 scroll-smooth custom-scrollbar"
      >
        <div className="flex flex-col gap-0.5">
          {filteredSegments.length > 0 ? (
            filteredSegments.map((segment) => {
              const originalIndex = segments.indexOf(segment);
              return (
                <TranscriptSegmentRow
                  key={`${segment.start_time}-${originalIndex}`}
                  ref={originalIndex === activeSegmentIndex ? activeRef : null}
                  segment={segment}
                  index={originalIndex}
                  isActive={originalIndex === activeSegmentIndex}
                  onClick={onSegmentClick}
                  searchQuery={searchQuery}
                  wordClickMode={wordClickMode}
                  selectedWords={selectedWords}
                  onWordClick={onWordClick}
                />
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">{t("searchEmpty", { query: searchQuery })}</p>
            </div>
          )}
        </div>
      </div>

      {/* "Follow progress" floating button — visible when auto-scroll is off (only in non-word-click mode) */}
      {!wordClickMode && !isAutoScrollEnabled && activeSegmentIndex >= 0 && (
        <div className="absolute bottom-4 right-4 animate-in fade-in slide-in-from-bottom-2">
          <Button
            size="sm"
            onClick={() => {
              setIsAutoScrollEnabled(true);
              activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="h-9 shadow-lg gap-2 rounded-full"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{t("followProgress")}</span>
          </Button>
        </div>
      )}

      {/* "Explain N words" floating button — visible when words are selected */}
      {wordClickMode && selectedCount > 0 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4 animate-in fade-in slide-in-from-bottom-2 z-10">
          <Button
            size="sm"
            onClick={onExplainWords}
            className="h-9 shadow-lg gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("explainWords", { count: selectedCount })}
          </Button>
        </div>
      )}
    </div>
  );
}
