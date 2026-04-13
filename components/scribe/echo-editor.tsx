"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Paragraph from "@tiptap/extension-paragraph";
import { DictionaryPopover } from "./dictionary-popover";
import type { TranscriptSegment } from "@/types/transcript";

export interface HighlightedWord {
    id: string; // Keeping interface compatibility, but we just use index now
    text: string;
}

// ── Custom extensions ─────────────────────────────────────────────
const TimestampedParagraph = Paragraph.extend({
    addAttributes() {
        return {
            timestamp: {
                default: null,
                parseHTML: (el) => el.getAttribute("data-timestamp"),
                renderHTML: (attrs) =>
                    attrs.timestamp ? { "data-timestamp": attrs.timestamp } : {},
            },
        };
    },
});

// ── Imperative handle ──────────────────────────────────────────────────────
export interface EchoEditorHandle {
    getHtml: () => string;
    isEmpty: () => boolean;
    getHighlightedWords: () => HighlightedWord[];
    getTranscriptSegments: () => TranscriptSegment[];
    updateHighlightedWord: (id: string, newText: string) => void;
}
// ── Props ──────────────────────────────────────────────────────────────────
export interface EchoEditorProps {
    onCommit: () => void;
    currentTime: number;
    /** localStorage key suffix for draft persistence. Omit to disable autosave. */
    draftKey?: string;
    initialContent?: string | null;
    className?: string;
    definitions?: Record<string, import("@/lib/ai/services").VocabularyExplanation>;
}
// ── localStorage helpers ───────────────────────────────────────────────────
const DRAFT_PREFIX = "echo-draft-";
function loadDraft(key: string): string | object | null {
    try {
        const raw = localStorage.getItem(DRAFT_PREFIX + key);
        // Try parsing JSON first (for backwards compatibility),
        // but if it fails or it's a raw string, return standard string HTML.
        if (raw?.startsWith("{")) {
            return JSON.parse(raw);
        }
        return raw; 
    } catch {
        return null;
    }
}
function saveDraft(key: string, data: string | object) {
    try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        localStorage.setItem(DRAFT_PREFIX + key, payload);
    } catch {
        // If storage is full, fail silently
    }
}
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
// ── Component ──────────────────────────────────────────────────────────────
export const EchoEditor = forwardRef<EchoEditorHandle, EchoEditorProps>(
    function EchoEditor({ onCommit, currentTime, draftKey, initialContent, className, definitions = {} }, ref) {
        const t = useTranslations("scribe");
        
        // Popover state
        const [popup, setPopup] = useState<{ visible: boolean; x: number; y: number; wordData?: import("@/lib/ai/services").VocabularyExplanation }>({
            visible: false,
            x: 0,
            y: 0,
            wordData: undefined
        });

        const onCommitRef = useRef(onCommit);
        const currentTimeRef = useRef(currentTime);
        const draftKeyRef = useRef(draftKey);
        useEffect(() => {
            onCommitRef.current = onCommit;
        }, [onCommit]);
        useEffect(() => {
            currentTimeRef.current = currentTime;
        }, [currentTime]);
        useEffect(() => {
            draftKeyRef.current = draftKey;
        }, [draftKey]);
        // Debounced save — writes to localStorage at most once per 1.5s
        const debouncedSave = useRef(
            debounce((key: string, data: string | object) => saveDraft(key, data), 1500)
        ).current;
        const editor = useEditor({
            immediatelyRender: false,
            extensions: [
                StarterKit.configure({ paragraph: false }),
                TimestampedParagraph,
                Highlight.configure({ multicolor: true }),
                Placeholder.configure({ placeholder: t("editorPlaceholder") }),
            ],
            // Restore draft content on mount (only if draftKey is provided)
            content: draftKey
                ? (loadDraft(draftKey) ?? initialContent ?? undefined)
                : (initialContent ?? undefined),
            editorProps: {
                attributes: {
                    class:
                        "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] h-full px-4 py-4",
                },
                handleKeyDown: (view, event) => {
                    // Shift+Enter → resume video, blur editor
                    if (event.key === "Enter" && event.shiftKey) {
                        event.preventDefault();
                        (view.dom as HTMLElement).blur();
                        onCommitRef.current();
                        return true;
                    }
                    return false;
                },
            },
            onUpdate({ editor: e }) {
                // Timestamp new paragraphs
                const node = e.state.selection.$from.parent;
                if (node.type.name === "paragraph" && node.attrs.timestamp === null) {
                    e.commands.updateAttributes("paragraph", {
                        timestamp: currentTimeRef.current,
                    });
                }
                // Debounced draft save (TipTap HTML) — only when draftKey is set
                // Saving pure HTML is much cleaner in localStorage
                if (draftKeyRef.current) {
                    debouncedSave(draftKeyRef.current, e.getHTML());
                }
            },
        });
        
        // Expose methods to parent
        useImperativeHandle(ref, () => ({
            getHtml: () => editor?.getHTML() ?? "",
            isEmpty: () => editor?.isEmpty ?? true,
            getHighlightedWords: () => {
                if (!editor) return [];
                const words: {text: string}[] = [];
                const doc = editor.state.doc;
                const boldType = editor.schema.marks.bold;

                doc.descendants((node) => {
                    if (node.isText && node.marks) {
                        const isBold = node.marks.some(m => m.type === boldType);
                        if (isBold) {
                            words.push({ text: node.text ?? "" });
                        }
                    }
                });
                
                // Merge adjacent bold text nodes 
                // (e.g. if formatting split the word into two bold nodes)
                const merged: {text: string}[] = [];
                let currentWord = "";
                let inBold = false;
                
                doc.descendants((node) => {
                    if (node.isText) {
                        const isBold = node.marks?.some(m => m.type === boldType);
                        if (isBold) {
                            currentWord += node.text;
                            inBold = true;
                        } else {
                            if (inBold && currentWord.trim()) {
                                merged.push({ text: currentWord.trim() });
                            }
                            currentWord = "";
                            inBold = false;
                        }
                    } else if (node.isBlock) {
                        // Breaks split words clearly
                        if (inBold && currentWord.trim()) {
                            merged.push({ text: currentWord.trim() });
                        }
                        currentWord = "";
                        inBold = false;
                    }
                });
                
                // Push concluding word
                if (inBold && currentWord.trim()) {
                    merged.push({ text: currentWord.trim() });
                }

                // Return deduped list by converting to Set and mapping back
                const uniqueWords = Array.from(new Set(merged.map(m => m.text)));
                return uniqueWords.map((w, index) => ({ id: `word-${index}`, text: w }));
            },
            getTranscriptSegments: () => {
                if (!editor) return [];

                const paragraphs: { text: string; start_time: number }[] = [];

                editor.state.doc.descendants((node) => {
                    if (node.type.name !== "paragraph") return true;

                    const text = node.textContent.trim();
                    if (!text) return true;

                    const rawTimestamp = node.attrs.timestamp;
                    const parsedTimestamp = Number(rawTimestamp);
                    paragraphs.push({
                        text,
                        start_time: Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0,
                    });

                    return true;
                });

                return paragraphs.map((paragraph, index) => {
                    const nextStart = paragraphs[index + 1]?.start_time;
                    const fallbackEnd = Math.max(paragraph.start_time + 4, currentTimeRef.current || 0);
                    const end_time =
                        typeof nextStart === "number" && nextStart > paragraph.start_time
                            ? nextStart
                            : fallbackEnd;

                    return {
                        start_time: paragraph.start_time,
                        end_time,
                        text: paragraph.text,
                    };
                });
            },
            updateHighlightedWord: () => {
                // Feature deprecated as per user request to drop two-way sync
                console.warn("Editing original text natively via modal is disabled.");
            }
        }));

        return (
            <div
                className={`rounded-xl border border-border bg-background shadow-inner overflow-hidden flex flex-col ${className ?? ""}`}
            >
                {/* Hint bar */}
                <div className="bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground border-b border-border flex items-center justify-between select-none">
                    <span className="font-mono font-semibold tracking-widest">{t("editorMode")}</span>
                    <span>{t("editorHint")}</span>
                </div>
                {/* Editor */}
                <div 
                  className="flex-1 overflow-y-auto custom-scrollbar relative"
                  onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'STRONG') {
                          const word = target.textContent?.trim() || "";
                          const wordData = definitions[word];
                          if (wordData) {
                              // Position popover near mouse
                              const offset = 10;
                              setPopup({
                                  visible: true,
                                  x: e.clientX + offset,
                                  y: e.clientY + offset,
                                  wordData
                              });
                          }
                      } else {
                          setPopup(prev => ({ ...prev, visible: false }));
                      }
                  }}
                >
                    <EditorContent editor={editor} />
                </div>
                
                {/* AI Hover Popover */}
                <DictionaryPopover
                  visible={popup.visible}
                  x={popup.x}
                  y={popup.y}
                  wordData={popup.wordData}
                  onClose={() => setPopup(prev => ({ ...prev, visible: false }))}
                />
            </div>
        );
    }
);
EchoEditor.displayName = "EchoEditor";
