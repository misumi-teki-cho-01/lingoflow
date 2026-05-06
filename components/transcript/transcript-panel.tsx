"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ScrollText,
  Search,
  MousePointerClick,
  X,
  Check,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { TranscriptSegmentRow } from "./transcript-segment";
import { DictionaryPopover } from "@/components/scribe/dictionary-popover";
import type { TranscriptSegment, DragState } from "@/types/transcript";
import type { TranscriptSource } from "@/lib/pipeline/transcription-pipeline";
import type { VocabularyExplanation } from "@/lib/ai/services";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  activeSegmentIndex: number;
  onSegmentClick: (time: number) => void;
  source?: TranscriptSource;
  isLoading?: boolean;
  errorMessage?: string;
  wordClickMode?: boolean;
  /** Position keys "segIdx-wordIdx" for highlighting selected instances only. */
  selectedPositionKeys?: Set<string>;
  /** posKey → current selected text (may be a sub-word after cycle). */
  selectedTextMap?: Map<string, string>;
  /** Number of CcSelection entries (may differ from selectedPositionKeys.size for phrases). */
  selectionCount?: number;
  /** Saved vocabulary definitions — used to show definition popover on click. */
  definitions?: Record<string, VocabularyExplanation>;
  /**
   * Position-keyed map "segIdx-wordIdx" → definition (CC mode).
   * When provided, definition indicators show only at these exact positions.
   */
  definitionPositionMap?: Map<string, VocabularyExplanation>;
  dragState?: DragState | null;
  onDragStart?: (segIdx: number, wordIdx: number) => void;
  onDragEnter?: (segIdx: number, wordIdx: number) => void;
  onDragEnd?: () => void;
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
  selectedPositionKeys,
  selectedTextMap,
  selectionCount = 0,
  definitions = {},
  definitionPositionMap,
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onExplainWords,
  onClearWords,
}: TranscriptPanelProps) {
  const t = useTranslations("transcript");
  const tCommon = useTranslations("common");

  const [searchQuery, setSearchQuery] = useState("");
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Definition popover state
  const [popup, setPopup] = useState<{
    visible: boolean; x: number; y: number; wordData?: VocabularyExplanation;
  }>({ visible: false, x: 0, y: 0 });

  // Lowercase key map for fast definition lookup
  const definitionKeyMap = useMemo(() => {
    const map = new Map<string, VocabularyExplanation>();
    Object.entries(definitions).forEach(([k, v]) => map.set(k.toLowerCase(), v));
    return map;
  }, [definitions]);

  const handleDefinitionClick = (cleanWord: string, x: number, y: number) => {
    const wordData = definitionKeyMap.get(cleanWord.toLowerCase());
    if (!wordData) return;
    setPopup((prev) =>
      prev.visible && prev.wordData === wordData
        ? { ...prev, visible: false }
        : { visible: true, x, y, wordData }
    );
  };

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

      {/* Scrollable segment list — cancel drag if pointer leaves the list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-2 py-2 pb-24 scroll-smooth custom-scrollbar"
        onMouseUp={() => onDragEnd?.()}
        onMouseLeave={() => {
          // Cancel (don't commit) if mouse leaves the panel while dragging
          if (dragState) onDragEnd?.();
        }}
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
                  onSeek={onSegmentClick}
                  onClick={wordClickMode ? undefined : onSegmentClick}
                  searchQuery={searchQuery}
                  wordClickMode={wordClickMode}
                  selectedPositionKeys={selectedPositionKeys}
                  selectedTextMap={selectedTextMap}
                  definitionKeyMap={definitionPositionMap ? undefined : definitionKeyMap}
                  definitionPositionMap={definitionPositionMap}
                  onDefinitionClick={handleDefinitionClick}
                  dragState={dragState}
                  onDragStart={onDragStart}
                  onDragEnter={onDragEnter}
                  onDragEnd={onDragEnd}
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

      {(wordClickMode || (!wordClickMode && !isAutoScrollEnabled && activeSegmentIndex >= 0)) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="bg-gradient-to-t from-card via-card/95 to-transparent px-3 pb-3 pt-10">
            <div
              className={`pointer-events-auto flex items-center gap-3 rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 ${
                wordClickMode ? "justify-between" : "justify-end"
              }`}
            >
              {wordClickMode && (
                <div className="min-w-0 flex-1 self-center">
                  <p className="text-xs leading-none text-muted-foreground">
                    {t("wordClickHint")}
                  </p>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-2 self-center">
                {wordClickMode && selectionCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    {t("clearSelection")}
                  </Button>
                )}

                {wordClickMode && selectionCount > 0 && (
                  <Button
                    size="sm"
                    onClick={onExplainWords}
                    className="h-9 gap-2 rounded-full bg-indigo-600 px-4 text-white shadow-md hover:bg-indigo-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t("explainWords", { count: selectionCount })}</span>
                  </Button>
                )}

                {!wordClickMode && !isAutoScrollEnabled && activeSegmentIndex >= 0 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsAutoScrollEnabled(true);
                      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className="h-9 gap-2 rounded-full px-4 shadow-md"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t("followProgress")}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-500/10 p-2 text-amber-600">
                <TriangleAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold">{t("clearSelectionConfirmTitle")}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("clearSelectionConfirmBody", { count: selectionCount })}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-full"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onClearWords?.();
                  setShowClearConfirm(false);
                }}
                className="rounded-full"
              >
                {tCommon("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Definition popover — rendered outside the scroll container so it's never clipped */}
      <DictionaryPopover
        visible={popup.visible}
        x={popup.x}
        y={popup.y}
        wordData={popup.wordData}
        onClose={() => setPopup((prev) => ({ ...prev, visible: false }))}
      />
    </div>
  );
}
