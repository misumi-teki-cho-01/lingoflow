import React, { useEffect, useRef, useState } from "react";
import type { VocabularyExplanation } from "@/lib/ai/services";

export interface DictionaryPopoverProps {
  visible: boolean;
  x: number;
  y: number;
  wordData?: VocabularyExplanation;
  onClose: () => void;
}

export function DictionaryPopover({ visible, x, y, wordData, onClose }: DictionaryPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedLeft, setAdjustedLeft] = useState(x);

  // Close on Esc
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onClose]);

  // Adjust horizontal position to stay within viewport after render
  useEffect(() => {
    if (!visible || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const overflow = rect.right - window.innerWidth;
    if (overflow > 0) {
      // Shift left enough to stay on screen (with 8px margin)
      setAdjustedLeft(Math.max(8, x - overflow - 8));
    } else {
      setAdjustedLeft(x);
    }
  }, [visible, x, y, wordData]);

  if (!visible || !wordData) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 max-w-[280px] p-3 rounded-xl border border-indigo-500/30 bg-card text-card-foreground shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200"
      style={{ left: adjustedLeft, top: y }}
      onClick={onClose}
    >
      <div className="font-semibold text-indigo-500 dark:text-indigo-400 mb-0.5 leading-tight flex items-baseline gap-2">
        <span>{wordData.original_text}</span>
        {wordData.canonical_form && wordData.canonical_form.toLowerCase() !== wordData.original_text.toLowerCase() && (
          <span className="text-xs font-mono text-muted-foreground opacity-70 bg-muted px-1 rounded">
            {wordData.canonical_form}
          </span>
        )}
      </div>
      <div className="text-sm text-foreground leading-relaxed mt-2">
        {wordData.explanation}
      </div>
    </div>
  );
}
