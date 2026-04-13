"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type JsonValidationMode = "segments" | "vocabulary";

export type JsonValidationStatus = "idle" | "valid" | "invalid";

export interface JsonValidationState {
  status: JsonValidationStatus;
  errorLine: number | null;
  errorCol: number | null;
  errorMessage: string | null;
  itemCount: number | null;
  jumpToError: (textareaEl: HTMLTextAreaElement | null) => void;
}

interface ErrorLocation {
  line: number;
  col: number;
  charPos: number;
}

/** Extract character offset from a V8/SpiderMonkey SyntaxError message. */
function extractErrorLocation(text: string, error: SyntaxError): ErrorLocation | null {
  // V8: "Unexpected token , in JSON at position 42"
  // Modern V8: "Expected property name or '}' in JSON at position 42"
  const posMatch = error.message.match(/at position (\d+)/i);
  if (posMatch) {
    const charPos = parseInt(posMatch[1]);
    const before = text.slice(0, charPos);
    const lines = before.split("\n");
    return {
      charPos,
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    };
  }

  // Firefox: "JSON.parse: unexpected character at line 3 column 5"
  const lineColMatch = error.message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    const line = parseInt(lineColMatch[1]);
    const col = parseInt(lineColMatch[2]);
    // Reconstruct charPos from line/col
    const lines = text.split("\n");
    let charPos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      charPos += lines[i].length + 1; // +1 for \n
    }
    charPos += col - 1;
    return { charPos, line, col };
  }

  return null;
}

function countItems(parsed: unknown, mode: JsonValidationMode): number | null {
  if (mode === "segments") {
    if (!Array.isArray(parsed)) return null;
    return parsed.length;
  }
  // vocabulary: object or array
  if (Array.isArray(parsed)) return parsed.length;
  if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
  return null;
}

export function useJsonValidation(
  text: string,
  mode: JsonValidationMode,
  debounceMs = 400
): JsonValidationState {
  const [status, setStatus] = useState<JsonValidationStatus>("idle");
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [errorCol, setErrorCol] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const errorCharPosRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!text.trim()) {
      setStatus("idle");
      setErrorLine(null);
      setErrorCol(null);
      setErrorMessage(null);
      setItemCount(null);
      errorCharPosRef.current = null;
      return;
    }

    timerRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(text);
        const count = countItems(parsed, mode);
        setStatus("valid");
        setErrorLine(null);
        setErrorCol(null);
        setErrorMessage(null);
        setItemCount(count);
        errorCharPosRef.current = null;
      } catch (err) {
        if (!(err instanceof SyntaxError)) return;
        const loc = extractErrorLocation(text, err);
        setStatus("invalid");
        setErrorLine(loc?.line ?? null);
        setErrorCol(loc?.col ?? null);
        // Simplify the error message for display
        const raw = err.message
          .replace(/^JSON\.parse:\s*/i, "")
          .replace(/\s*at position \d+/i, "")
          .replace(/\s*in JSON\s*/i, "");
        setErrorMessage(raw);
        setItemCount(null);
        errorCharPosRef.current = loc?.charPos ?? null;
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, mode, debounceMs]);

  const jumpToError = useCallback((textareaEl: HTMLTextAreaElement | null) => {
    if (!textareaEl || errorCharPosRef.current === null) return;
    const pos = errorCharPosRef.current;
    const start = Math.max(0, pos - 5);
    const end = Math.min(textareaEl.value.length, pos + 30);

    textareaEl.focus();
    textareaEl.setSelectionRange(start, end);

    // Scroll the textarea so the selection is visible
    // We do this by temporarily measuring line height
    const lines = textareaEl.value.slice(0, start).split("\n");
    const lineHeight = parseInt(getComputedStyle(textareaEl).lineHeight) || 20;
    textareaEl.scrollTop = Math.max(0, (lines.length - 3) * lineHeight);
  }, []);

  return { status, errorLine, errorCol, errorMessage, itemCount, jumpToError };
}
