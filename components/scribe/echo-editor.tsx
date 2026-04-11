"use client";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Paragraph from "@tiptap/extension-paragraph";
import { toggleMark } from "prosemirror-commands";
// ── Custom paragraph extension ─────────────────────────────────────────────
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
}
// ── Props ──────────────────────────────────────────────────────────────────
export interface EchoEditorProps {
    onCommit: () => void;
    currentTime: number;
    /** localStorage key suffix for draft persistence. Omit to disable autosave. */
    draftKey?: string;
    className?: string;
}
// ── localStorage helpers ───────────────────────────────────────────────────
const DRAFT_PREFIX = "echo-draft-";
function loadDraft(key: string): object | null {
    try {
        const raw = localStorage.getItem(DRAFT_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
function saveDraft(key: string, json: object) {
    try {
        localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(json));
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
    function EchoEditor({ onCommit, currentTime, draftKey, className }, ref) {
        const t = useTranslations("scribe");
        const onCommitRef = useRef(onCommit);
        onCommitRef.current = onCommit;
        const currentTimeRef = useRef(currentTime);
        currentTimeRef.current = currentTime;
        const draftKeyRef = useRef(draftKey);
        draftKeyRef.current = draftKey;
        // Debounced save — writes to localStorage at most once per 1.5s
        const debouncedSave = useRef(
            debounce((key: string, json: object) => saveDraft(key, json), 1500)
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
            content: draftKey ? (loadDraft(draftKey) ?? undefined) : undefined,
            editorProps: {
                attributes: {
                    class:
                        "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] h-full px-4 py-4",
                },
                handleKeyDown: (view, event) => {
                    // ⌘B / Ctrl+B → toggle bold (displayed as highlight via CSS)
                    if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        const boldType = view.state.schema.marks.bold;
                        if (boldType) {
                            toggleMark(boldType)(view.state, view.dispatch);
                        }
                        return true;
                    }
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
                // Debounced draft save (TipTap JSON) — only when draftKey is set
                if (draftKeyRef.current) {
                    debouncedSave(draftKeyRef.current, e.getJSON());
                }
            },
        });
        // Expose methods to parent
        useImperativeHandle(ref, () => ({
            getHtml: () => editor?.getHTML() ?? "",
            isEmpty: () => editor?.isEmpty ?? true,
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
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <EditorContent editor={editor} />
                </div>
            </div>
        );
    }
);
EchoEditor.displayName = "EchoEditor";