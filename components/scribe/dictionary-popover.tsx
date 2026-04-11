import React from "react";

export interface DictionaryPopoverProps {
  visible: boolean;
  x: number;
  y: number;
  word: string;
  meaning: string;
  onClose: () => void;
}

export function DictionaryPopover({ visible, x, y, word, meaning, onClose }: DictionaryPopoverProps) {
  if (!visible) return null;

  return (
    <div 
      className="fixed z-50 max-w-[280px] p-3 rounded-xl border border-indigo-500/30 bg-card text-card-foreground shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200"
      style={{ left: x, top: y }}
      onClick={onClose}
    >
      <div className="font-semibold text-indigo-500 dark:text-indigo-400 mb-1 leading-tight">
        {word}
      </div>
      <div className="text-sm text-foreground leading-relaxed">
        {meaning}
      </div>
    </div>
  );
}
