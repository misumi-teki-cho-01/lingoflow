import TurndownService from "turndown";
import type { TranscriptSegment } from "@/types/transcript";
import { formatTime } from "./format";

// ── Turndown service ───────────────────────────────────────────────────────
const td = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

// Bold text = "mark for review" — preserve as Markdown bold
td.addRule("boldMark", {
  filter: ["strong", "b"],
  replacement: (content) => `**${content}**`,
});

// ── Shared types ───────────────────────────────────────────────────────────
export interface ExportMetadata {
  title: string;
  url: string;
  channelName?: string;
  duration?: number;
  date: string;
}

function buildHeader(metadata: ExportMetadata): string {
  const lines: string[] = [
    `# ${metadata.title || "Untitled"}`,
    `**Source:** [${metadata.url}](${metadata.url})`,
  ];
  if (metadata.channelName) lines.push(`**Channel:** ${metadata.channelName}`);
  if (metadata.duration)
    lines.push(
      `**Duration:** ${Math.floor(metadata.duration / 60)}m ${metadata.duration % 60}s`
    );
  lines.push(`**Date:** ${metadata.date}`, "", "---", "");
  return lines.join("\n");
}

// ── Echo Scribe export (HTML → Markdown) ──────────────────────────────────
/**
 * Converts TipTap HTML + metadata into a Markdown document.
 */
export function convertToMarkdown(html: string, metadata: ExportMetadata): string {
  return buildHeader(metadata) + td.turndown(html);
}

// ── CC Transcript export (segments → Markdown) ───────────────────────────
/**
 * Converts raw transcript segments + metadata into a Markdown document.
 * Each segment is rendered as `[MM:SS] text`.
 */
export function convertTranscriptToMarkdown(
  segments: TranscriptSegment[],
  metadata: ExportMetadata
): string {
  const body = segments
    .map((s) => `[${formatTime(s.start_time)}] ${s.text}`)
    .join("\n");
  return buildHeader(metadata) + body;
}

// ── Download helper ────────────────────────────────────────────────────────
export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
