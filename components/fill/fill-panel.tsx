"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollText, MousePointerClick, Check, Sparkles } from "lucide-react";
import { DictionaryPopover } from "@/components/scribe/dictionary-popover";
import { FillSegmentRow, type HintLevel } from "./fill-segment-row";
import type { TranscriptSegment, DragState } from "@/types/transcript";
import type { VocabularyExplanation } from "@/lib/ai/services";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FillPanelProps {
  segments: TranscriptSegment[];
  activeSegmentIndex: number;
  onSegmentClick: (time: number) => void;
  isLoading?: boolean;
  errorMessage?: string;
  // Shared CC marking state
  selectedPositionKeys?: Set<string>;
  selectionCount?: number;
  definitions?: Record<string, VocabularyExplanation>;
  dragState?: DragState | null;
  onDragStart?: (segIdx: number, wordIdx: number) => void;
  onDragEnter?: (segIdx: number, wordIdx: number) => void;
  onDragEnd?: () => void;
  onExplainWords?: () => void;
  onClearWords?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FillPanel({
  segments,
  activeSegmentIndex,
  onSegmentClick,
  isLoading = false,
  errorMessage,
  selectedPositionKeys,
  selectionCount = 0,
  definitions = {},
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onExplainWords,
  onClearWords,
}: FillPanelProps) {
  const t = useTranslations("studyRoom");
  const tTranscript = useTranslations("transcript");

  const [hintLevel, setHintLevel] = useState<HintLevel>("width");
  // segIdx → (wordIdx → typed value)
  const [answers, setAnswers] = useState<Map<number, Map<number, string>>>(new Map());
  const [checkedSegments, setCheckedSegments] = useState<Set<number>>(new Set());
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  // Definition popover state (panel-level, so it appears above scroll container)
  const [popup, setPopup] = useState<{
    visible: boolean; x: number; y: number; wordData?: VocabularyExplanation;
  }>({ visible: false, x: 0, y: 0 });

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

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentIndex < 0 || !isAutoScrollEnabled) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSegmentIndex, isAutoScrollEnabled]);

  // ── Answer handlers ──────────────────────────────────────────────────────────

  const handleAnswerChange = (segIdx: number, wordIdx: number, value: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const seg = new Map(next.get(segIdx) ?? []);
      seg.set(wordIdx, value);
      next.set(segIdx, seg);
      return next;
    });
  };

  const handleCheck = (segIdx: number) => {
    setCheckedSegments((prev) => new Set(prev).add(segIdx));
  };

  const handleRetry = (segIdx: number) => {
    setCheckedSegments((prev) => {
      const next = new Set(prev);
      next.delete(segIdx);
      return next;
    });
    setAnswers((prev) => {
      const next = new Map(prev);
      next.delete(segIdx);
      return next;
    });
  };

  // ── Loading state ────────────────────────────────────────────────────────────
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

  // ── Empty / error state ──────────────────────────────────────────────────────
  if (errorMessage || segments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <div className="rounded-full bg-muted p-5">
          <ScrollText className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <div className="max-w-[200px]">
          <p className="font-semibold">
            {errorMessage ? tTranscript("fetchFailed") : tTranscript("noSubtitles")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {errorMessage ?? tTranscript("noSubtitlesDesc")}
          </p>
        </div>
      </div>
    );
  }

  // ── Main panel ────────────────────────────────────────────────────────────────

  const HINT_OPTIONS: { value: HintLevel; label: string }[] = [
    { value: "none",   label: t("fillHintNone") },
    { value: "width",  label: t("fillHintWidth") },
    { value: "reveal", label: t("fillHintReveal") },
  ];

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-col border-b border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold tracking-tight">{t("fillMode")}</span>

            {/* Hint level selector */}
            <div className="flex items-center gap-1 rounded-full border border-border bg-background/60 p-0.5">
              {HINT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHintLevel(opt.value)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    hintLevel === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {selectionCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground"
                onClick={onClearWords}
              >
                {tTranscript("clearSelection")}
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
              title={tTranscript("autoScroll")}
            >
              <MousePointerClick className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable segment list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-2 py-2 scroll-smooth custom-scrollbar"
        onMouseUp={() => onDragEnd?.()}
        onMouseLeave={() => {
          if (dragState) onDragEnd?.();
        }}
      >
        <div className="flex flex-col gap-0.5">
          {segments.map((segment, idx) => (
            <div
              key={`${segment.start_time}-${idx}`}
              ref={idx === activeSegmentIndex ? activeRef : null}
            >
              <FillSegmentRow
                segment={segment}
                index={idx}
                isActive={idx === activeSegmentIndex}
                onSeek={onSegmentClick}
                hintLevel={hintLevel}
                answers={answers.get(idx) ?? new Map()}
                onAnswerChange={(wordIdx, value) => handleAnswerChange(idx, wordIdx, value)}
                isChecked={checkedSegments.has(idx)}
                onCheck={() => handleCheck(idx)}
                onRetry={() => handleRetry(idx)}
                selectedPositionKeys={selectedPositionKeys}
                definitionKeyMap={definitionKeyMap}
                onDefinitionClick={handleDefinitionClick}
                dragState={dragState}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragEnd={onDragEnd}
              />
            </div>
          ))}
        </div>
      </div>

      {/* "Follow progress" floating button */}
      {!isAutoScrollEnabled && activeSegmentIndex >= 0 && (
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
            <span>{tTranscript("followProgress")}</span>
          </Button>
        </div>
      )}

      {/* "Explain N words" floating button */}
      {selectionCount > 0 && (
        <div className={`absolute ${!isAutoScrollEnabled && activeSegmentIndex >= 0 ? "bottom-16" : "bottom-4"} left-0 right-0 flex justify-center px-4 animate-in fade-in slide-in-from-bottom-2 z-10`}>
          <Button
            size="sm"
            onClick={onExplainWords}
            className="h-9 shadow-lg gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {tTranscript("explainWords", { count: selectionCount })}
          </Button>
        </div>
      )}

      {/* Definition popover */}
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
