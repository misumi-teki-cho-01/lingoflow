"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { formatTime, stripPunctuation } from "@/lib/utils/format";
import { DictionaryPopover } from "@/components/scribe/dictionary-popover";
import { useState } from "react";
import type { TranscriptSegment, DragState } from "@/types/transcript";
import type { VocabularyExplanation } from "@/lib/ai/services";

// ── Types ────────────────────────────────────────────────────────────────────

export type HintLevel = "none" | "width" | "reveal";

type FillToken =
  | { type: "space"; value: string }
  | { type: "word"; word: string; suffix: string; wordIdx: number };

export interface FillSegmentRowProps {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  onSeek: (time: number) => void;
  hintLevel: HintLevel;
  /** wordIdx → typed value */
  answers: Map<number, string>;
  onAnswerChange: (wordIdx: number, value: string) => void;
  isChecked: boolean;
  onCheck: () => void;
  onRetry: () => void;
  // Post-check word marking (shared with CC mode)
  selectedPositionKeys?: Set<string>;
  definitionKeyMap?: Map<string, VocabularyExplanation>;
  onDefinitionClick?: (cleanWord: string, x: number, y: number) => void;
  dragState?: DragState | null;
  onDragStart?: (segIdx: number, wordIdx: number) => void;
  onDragEnter?: (segIdx: number, wordIdx: number) => void;
  onDragEnd?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PUNCT_SUFFIX = /[.,!?;:'"()[\]{}<>]+$/;

function tokenizeForFill(text: string): FillToken[] {
  let wordIdx = 0;
  return text.split(/(\s+)/).map((token): FillToken => {
    if (/^\s+$/.test(token)) return { type: "space", value: token };
    const suffixMatch = token.match(PUNCT_SUFFIX);
    const suffix = suffixMatch?.[0] ?? "";
    const word = suffix ? token.slice(0, -suffix.length) : token;
    return { type: "word", word, suffix, wordIdx: wordIdx++ };
  });
}

/** Strip punctuation, lowercase, trim — for loose answer comparison. */
function normalise(s: string): string {
  return s.replace(/[.,!?;:'"()[\]{}<>]+/g, "").toLowerCase().trim();
}

function checkAnswer(input: string, original: string): boolean {
  return normalise(input) === normalise(original);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FillSegmentRow({
  segment,
  index,
  isActive,
  onSeek,
  hintLevel,
  answers,
  onAnswerChange,
  isChecked,
  onCheck,
  onRetry,
  selectedPositionKeys,
  definitionKeyMap,
  onDefinitionClick,
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: FillSegmentRowProps) {
  const t = useTranslations("studyRoom");
  const rowRef = useRef<HTMLDivElement>(null);

  // Definition popover for this row
  const [popup, setPopup] = useState<{
    visible: boolean; x: number; y: number; wordData?: VocabularyExplanation;
  }>({ visible: false, x: 0, y: 0 });

  const handleDefinitionClick = (cleanWord: string, x: number, y: number) => {
    if (onDefinitionClick) {
      onDefinitionClick(cleanWord, x, y);
    } else {
      const wordData = definitionKeyMap?.get(cleanWord.toLowerCase());
      if (!wordData) return;
      setPopup((prev) =>
        prev.visible && prev.wordData === wordData
          ? { ...prev, visible: false }
          : { visible: true, x, y, wordData }
      );
    }
  };

  const tokens = tokenizeForFill(segment.text);

  // Build phrase-aware definition map for post-check spans
  const defAtWordIdx = new Map<number, VocabularyExplanation>();
  if (definitionKeyMap && definitionKeyMap.size > 0) {
    const wordTokens = tokens
      .filter((t): t is Extract<FillToken, { type: "word" }> => t.type === "word")
      .map((t) => t.word);

    // Pass 1: phrase matches
    definitionKeyMap.forEach((def, phrase) => {
      if (!phrase.includes(" ")) return;
      const phraseWords = phrase.split(/\s+/);
      for (let i = 0; i <= wordTokens.length - phraseWords.length; i++) {
        if (defAtWordIdx.has(i)) continue;
        const matches = phraseWords.every(
          (pw, j) => stripPunctuation(wordTokens[i + j]).toLowerCase() === pw
        );
        if (matches) defAtWordIdx.set(i, def);
      }
    });

    // Pass 2: single-word matches
    wordTokens.forEach((word, i) => {
      if (defAtWordIdx.has(i)) return;
      const clean = stripPunctuation(word).toLowerCase();
      if (!clean) return;
      const def = definitionKeyMap.get(clean);
      if (def) defAtWordIdx.set(i, def);
    });
  }

  // Determine if any input has been filled (to activate the Check button)
  const hasAnyInput = Array.from(answers.values()).some((v) => v.trim() !== "");

  // Collect word tokens for tab navigation refs
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, wordIdx: number) => {
    if (e.key === "Tab") {
      // Find next word input in this segment
      const wordCount = tokens.filter((t) => t.type === "word").length;
      const dir = e.shiftKey ? -1 : 1;
      const next = wordIdx + dir;
      if (next >= 0 && next < wordCount) {
        e.preventDefault();
        inputRefs.current.get(next)?.focus();
      }
    } else if (e.key === "Enter" && hasAnyInput && !isChecked) {
      e.preventDefault();
      onCheck();
    }
  };

  return (
    <div
      ref={rowRef}
      className={`
        group flex gap-4 rounded-lg px-4 py-3 transition-all duration-200
        ${isActive ? "bg-primary/10 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/50"}
      `}
    >
      {/* Timestamp & play button */}
      <div className="mt-1 flex flex-col items-center gap-1 w-10 shrink-0">
        <span
          className={`
            font-mono text-[10px] tabular-nums transition-colors
            ${isActive ? "text-primary font-bold" : "text-muted-foreground/50 group-hover:text-muted-foreground"}
          `}
        >
          {formatTime(segment.start_time)}
        </span>
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

      {/* Fill area */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed flex flex-wrap items-baseline gap-y-1">
          {tokens.map((token, i) => {
            if (token.type === "space") {
              return <span key={i}>&nbsp;</span>;
            }

            const { word, suffix, wordIdx } = token;
            const defForWord = defAtWordIdx.get(wordIdx);
            const hasDef = defForWord != null;
            const isPhraseDef = hasDef && defForWord.original_text.includes(" ");

            if (!isChecked) {
              // ── Input mode ────────────────────────────────────────────────
              const inputWidth =
                hintLevel === "none"
                  ? "4ch"
                  : `${Math.max(3, word.length)}ch`;
              const placeholder = hintLevel === "reveal" ? word : "";

              return (
                <span key={i} className="inline-flex items-baseline">
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(wordIdx, el);
                      else inputRefs.current.delete(wordIdx);
                    }}
                    type="text"
                    value={answers.get(wordIdx) ?? ""}
                    onChange={(e) => onAnswerChange(wordIdx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, wordIdx)}
                    placeholder={placeholder}
                    style={{ width: inputWidth }}
                    className="
                      inline-block border-b-2 border-muted-foreground/30
                      bg-transparent text-sm text-center outline-none
                      placeholder:text-muted-foreground/40
                      focus:border-primary transition-colors
                      min-w-[2ch] px-0.5
                    "
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  {suffix && <span className="text-muted-foreground">{suffix}</span>}
                </span>
              );
            } else {
              // ── Checked / revealed mode ──────────────────────────────────
              const typed = answers.get(wordIdx) ?? "";
              const correct = checkAnswer(typed, word);
              const posKey = `${index}-${wordIdx}`;
              const isSelected = selectedPositionKeys?.has(posKey) ?? false;
              const isInDrag =
                dragState != null &&
                dragState.segmentIndex === index &&
                wordIdx >= Math.min(dragState.startIdx, dragState.currentIdx) &&
                wordIdx <= Math.max(dragState.startIdx, dragState.currentIdx);
              const highlighted = isSelected || isInDrag;

              return (
                <span key={i} className="inline-flex flex-col items-center">
                  <span
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!hasDef) onDragStart?.(index, wordIdx);
                    }}
                    onMouseEnter={() => onDragEnter?.(index, wordIdx)}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      onDragEnd?.();
                    }}
                    onClick={(e) => {
                      if (hasDef && defForWord) {
                        e.stopPropagation();
                        handleDefinitionClick(
                          defForWord.original_text.toLowerCase(),
                          e.clientX + 10,
                          e.clientY + 10
                        );
                      }
                    }}
                    className={`
                      cursor-pointer rounded px-0.5 transition-colors select-none
                      ${highlighted
                        ? "bg-indigo-200 dark:bg-indigo-500/40 text-indigo-900 dark:text-indigo-100"
                        : correct
                          ? hasDef
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400"
                      }
                      ${hasDef
                        ? `border-b-2 border-indigo-400 dark:border-indigo-500 ${isPhraseDef ? "border-dashed" : ""}`
                        : correct
                          ? ""
                          : "border-b-2 border-red-400"
                      }
                    `}
                  >
                    {word}
                  </span>
                  {!correct && typed.trim() !== "" && (
                    <span className="text-[10px] text-red-400 line-through leading-none">
                      {typed}
                    </span>
                  )}
                  {suffix && <span className="self-baseline text-muted-foreground">{suffix}</span>}
                </span>
              );
            }
          })}
        </p>

        {/* Action buttons row */}
        <div className="mt-2 flex items-center gap-2">
          {!isChecked ? (
            <button
              type="button"
              disabled={!hasAnyInput}
              onClick={onCheck}
              className="
                text-xs px-2.5 py-1 rounded-md font-medium transition-colors
                bg-primary/10 text-primary hover:bg-primary/20
                disabled:opacity-30 disabled:cursor-not-allowed
              "
            >
              {t("fillCheck")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="
                text-xs px-2.5 py-1 rounded-md font-medium transition-colors
                bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground
              "
            >
              {t("fillRetry")}
            </button>
          )}
        </div>
      </div>

      {/* Per-row definition popover (fallback if no panel-level handler) */}
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
