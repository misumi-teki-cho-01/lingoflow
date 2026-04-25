import { forwardRef, memo } from "react";
import { formatTime, stripPunctuation } from "@/lib/utils/format";
import { Play } from "lucide-react";
import type { TranscriptSegment, CcSelection, DragState } from "@/types/transcript";
import type { VocabularyExplanation } from "@/lib/ai/services";

interface TranscriptSegmentProps {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  /** Seek the video to a timestamp. Always available (used by the ▶ button). */
  onSeek: (time: number) => void;
  /**
   * Legacy prop: used when wordClickMode=false to make the entire row seekable
   * (search/default mode). When wordClickMode=true, only the ▶ button seeks.
   */
  onClick?: (time: number) => void;
  searchQuery?: string;
  wordClickMode?: boolean;
  /** Position keys "segIdx-wordIdx" — only the matching instance is highlighted. */
  selectedPositionKeys?: Set<string>;
  onWordSelect?: (sel: CcSelection) => void;
  dragState?: DragState | null;
  onDragStart?: (segIdx: number, wordIdx: number) => void;
  onDragEnter?: (segIdx: number, wordIdx: number) => void;
  onDragEnd?: () => void;
  /** Map of lowercase word → definition, for showing popover on click in CC mode. */
  definitionKeyMap?: Map<string, VocabularyExplanation>;
  /**
   * Position-keyed definition map: "segIdx-wordIdx" → definition.
   * When provided, definition indicators are shown ONLY at these exact positions
   * (position-specific, not text-match-based). Used in CC / fill modes so that
   * only the specifically-marked occurrence shows the underline, not every
   * occurrence of the same word across the transcript.
   */
  definitionPositionMap?: Map<string, VocabularyExplanation>;
  onDefinitionClick?: (cleanWord: string, x: number, y: number) => void;
}

/** Highlights matching text within a segment for the search query. */
function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-400/30 text-foreground rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** Splits text into word tokens for position-based selection and drag-to-select. */
function WordClickableText({
  text,
  segmentIndex,
  selectedPositionKeys,
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
  definitionKeyMap,
  definitionPositionMap,
  onDefinitionClick,
}: {
  text: string;
  segmentIndex: number;
  selectedPositionKeys?: Set<string>;
  dragState?: DragState | null;
  onDragStart?: (segIdx: number, wordIdx: number) => void;
  onDragEnter?: (segIdx: number, wordIdx: number) => void;
  onDragEnd?: () => void;
  definitionKeyMap?: Map<string, VocabularyExplanation>;
  definitionPositionMap?: Map<string, VocabularyExplanation>;
  onDefinitionClick?: (cleanWord: string, x: number, y: number) => void;
}) {
  const tokens = text.split(/(\s+)/);

  // ── Definition lookup ─────────────────────────────────────────────────────
  // Two modes:
  //  • definitionPositionMap provided → position-specific (CC/fill modes):
  //    only the exact "segIdx-wordIdx" positions that were marked show indicators.
  //  • fallback text-based → phrase-aware scan (scribe mode / legacy).
  const defAtWordIdx = new Map<number, VocabularyExplanation>();

  if (definitionPositionMap) {
    // Position-based: iterate all word tokens and check the position map directly.
    let wi = 0;
    for (const token of tokens) {
      if (/^\s+$/.test(token)) continue;
      const posKey = `${segmentIndex}-${wi}`;
      const def = definitionPositionMap.get(posKey);
      if (def) defAtWordIdx.set(wi, def);
      wi++;
    }
  } else if (definitionKeyMap && definitionKeyMap.size > 0) {
    const nonWsTokens = tokens.filter((t) => !/^\s+$/.test(t));

    // Pass 1: phrase matches (keys that contain spaces).
    // Done first so a phrase like "run out" wins over single "run".
    definitionKeyMap.forEach((def, phrase) => {
      if (!phrase.includes(" ")) return;
      const phraseWords = phrase.split(/\s+/);
      for (let i = 0; i <= nonWsTokens.length - phraseWords.length; i++) {
        if (defAtWordIdx.has(i)) continue; // already claimed by a longer phrase
        const matches = phraseWords.every(
          (pw, j) => stripPunctuation(nonWsTokens[i + j]).toLowerCase() === pw
        );
        if (matches) defAtWordIdx.set(i, def);
      }
    });

    // Pass 2: single-word matches (don't override phrase matches).
    nonWsTokens.forEach((token, i) => {
      if (defAtWordIdx.has(i)) return;
      const clean = stripPunctuation(token).toLowerCase();
      if (!clean) return;
      const def = definitionKeyMap.get(clean);
      if (def) defAtWordIdx.set(i, def);
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  let wordIdx = 0;

  return (
    <>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return <span key={i}>{token}</span>;
        }

        const currentWordIdx = wordIdx++;
        const posKey = `${segmentIndex}-${currentWordIdx}`;
        const isSelected = selectedPositionKeys?.has(posKey) ?? false;

        // Drag-preview highlight: same segment, within drag range
        const isInDrag =
          dragState != null &&
          dragState.segmentIndex === segmentIndex &&
          currentWordIdx >= Math.min(dragState.startIdx, dragState.currentIdx) &&
          currentWordIdx <= Math.max(dragState.startIdx, dragState.currentIdx);

        const highlighted = isSelected || isInDrag;

        const defForWord = defAtWordIdx.get(currentWordIdx);
        const hasDef = defForWord != null;
        // Phrase definitions get a dashed underline; single-word get solid.
        const isPhraseDef = hasDef && defForWord.original_text.includes(" ");

        return (
          <span
            key={i}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent native text selection
              // Words with saved definitions are tap-to-view only — don't start a drag.
              if (!hasDef) onDragStart?.(segmentIndex, currentWordIdx);
            }}
            onMouseEnter={() => {
              onDragEnter?.(segmentIndex, currentWordIdx);
            }}
            onMouseUp={(e) => {
              e.stopPropagation(); // prevent double-fire from container's onMouseUp
              onDragEnd?.();
            }}
            onClick={(e) => {
              if (hasDef && defForWord) {
                e.stopPropagation();
                // Pass the full phrase key so the panel can look it up in definitionKeyMap.
                onDefinitionClick?.(
                  defForWord.original_text.toLowerCase(),
                  e.clientX + 10,
                  e.clientY + 10
                );
              }
            }}
            className={`cursor-pointer rounded px-0.5 transition-colors select-none ${
              highlighted
                ? "bg-indigo-200 dark:bg-indigo-500/40 text-indigo-900 dark:text-indigo-100"
                : hasDef
                  ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  : "hover:bg-muted"
            } ${
              hasDef
                ? `border-b-2 border-indigo-400 dark:border-indigo-500 ${isPhraseDef ? "border-dashed" : ""}`
                : ""
            }`}
          >
            {token}
          </span>
        );
      })}
    </>
  );
}

export const TranscriptSegmentRow = memo(
  forwardRef<HTMLDivElement, TranscriptSegmentProps>(
    function TranscriptSegmentRow(
      {
        segment,
        index,
        isActive,
        onSeek,
        onClick,
        searchQuery,
        wordClickMode,
        selectedPositionKeys,
        dragState,
        onDragStart,
        onDragEnter,
        onDragEnd,
        definitionKeyMap,
        definitionPositionMap,
        onDefinitionClick,
      },
      ref
    ) {
      return (
        <div
          ref={ref}
          // In word-click mode the row is NOT interactive — only the ▶ button seeks.
          // In search/default mode the whole row is still clickable.
          role={wordClickMode ? undefined : "button"}
          tabIndex={wordClickMode ? undefined : 0}
          onClick={
            wordClickMode
              ? undefined
              : () => (onClick ?? onSeek)(segment.start_time)
          }
          onKeyDown={
            wordClickMode
              ? undefined
              : (e) => e.key === "Enter" && (onClick ?? onSeek)(segment.start_time)
          }
          className={`
            group flex gap-4 rounded-lg px-4 py-3 transition-all duration-200 outline-none
            ${wordClickMode ? "" : "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50"}
            ${isActive ? "bg-primary/10 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/50"}
          `}
        >
          {/* Timestamp & play button */}
          <div className="mt-0.5 flex flex-col items-center gap-1 w-10 shrink-0">
            <span
              className={`
                font-mono text-[10px] tabular-nums transition-colors
                ${isActive ? "text-primary font-bold" : "text-muted-foreground/50 group-hover:text-muted-foreground"}
              `}
            >
              {formatTime(segment.start_time)}
            </span>
            {/* ▶ is always a real button — the only seek trigger in word-click mode */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSeek(segment.start_time);
              }}
              aria-label={`Seek to ${formatTime(segment.start_time)}`}
              className={`transition-all duration-200 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                isActive
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
              }`}
            >
              <Play
                className={`h-3 w-3 ${isActive ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </button>
          </div>

          {/* Text */}
          <p
            className={`
              flex-1 text-sm leading-relaxed transition-colors
              ${isActive ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"}
            `}
          >
            {wordClickMode ? (
              <WordClickableText
                text={segment.text}
                segmentIndex={index}
                selectedPositionKeys={selectedPositionKeys}
                dragState={dragState}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragEnd={onDragEnd}
                definitionKeyMap={definitionKeyMap}
                definitionPositionMap={definitionPositionMap}
                onDefinitionClick={onDefinitionClick}
              />
            ) : (
              <HighlightedText text={segment.text} query={searchQuery} />
            )}
          </p>
        </div>
      );
    }
  )
);

TranscriptSegmentRow.displayName = "TranscriptSegmentRow";
