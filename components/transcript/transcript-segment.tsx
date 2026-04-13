import { forwardRef, memo } from "react";
import { formatTime, normalizeWord } from "@/lib/utils/format";
import { Play } from "lucide-react";
import type { TranscriptSegment } from "@/types/transcript";

interface TranscriptSegmentProps {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  onClick: (time: number) => void;
  searchQuery?: string;
  wordClickMode?: boolean;
  selectedWords?: Set<string>;
  onWordClick?: (word: string) => void;
}

/** Highlights matching text within a segment for the search query. */
function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;

  // Escape regex special chars to prevent errors on user input like "(" or "["
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

/** Splits text into tokens (words + whitespace) for word-click mode. */
function WordClickableText({
  text,
  selectedWords,
  onWordClick,
}: {
  text: string;
  selectedWords?: Set<string>;
  onWordClick?: (word: string) => void;
}) {
  // Split on whitespace boundaries, keeping the separators
  const tokens = text.split(/(\s+)/);

  return (
    <>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return <span key={i}>{token}</span>;
        }
        const normalized = normalizeWord(token);
        if (!normalized) {
          return <span key={i}>{token}</span>;
        }
        const isSelected = selectedWords?.has(normalized) ?? false;
        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onWordClick?.(normalized);
            }}
            className={`cursor-pointer rounded px-0.5 transition-colors select-none ${
              isSelected
                ? "bg-indigo-200 dark:bg-indigo-500/40 text-indigo-900 dark:text-indigo-100"
                : "hover:bg-muted"
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
      { segment, isActive, onClick, searchQuery, wordClickMode, selectedWords, onWordClick },
      ref
    ) {
      return (
        <div
          ref={ref}
          role="button"
          tabIndex={0}
          onClick={() => onClick(segment.start_time)}
          onKeyDown={(e) => e.key === "Enter" && onClick(segment.start_time)}
          className={`
            group flex cursor-pointer gap-4 rounded-lg px-4 py-3 transition-all duration-200 outline-none
            focus-visible:ring-2 focus-visible:ring-primary/50
            ${isActive ? "bg-primary/10 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/50"}
          `}
        >
          {/* Timestamp & play icon */}
          <div className="mt-0.5 flex flex-col items-center gap-1 w-10 shrink-0">
            <span
              className={`
                font-mono text-[10px] tabular-nums transition-colors
                ${isActive ? "text-primary font-bold" : "text-muted-foreground/50 group-hover:text-muted-foreground"}
              `}
            >
              {formatTime(segment.start_time)}
            </span>
            <div
              className={`transition-all duration-200 ${
                isActive
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
              }`}
            >
              <Play
                className={`h-3 w-3 ${isActive ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </div>
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
                selectedWords={selectedWords}
                onWordClick={onWordClick}
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
