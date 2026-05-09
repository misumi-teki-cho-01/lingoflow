import type { TranscriptSegment } from '@/types/transcript';

function parseTimestamp(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length < 2) return Number.NaN;

  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length > 0 ? Number(parts.pop()) : 0;

  if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) return Number.NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

function cleanCueText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCueBlocks(content: string): TranscriptSegment[] {
  return content
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const timingIndex = lines.findIndex((line) => line.includes('-->'));
      if (timingIndex < 0) return [];

      const [startRaw, endRawWithSettings] = lines[timingIndex].split('-->');
      const endRaw = endRawWithSettings?.trim().split(/\s+/)[0];
      const start = parseTimestamp(startRaw);
      const end = parseTimestamp(endRaw ?? '');
      const text = cleanCueText(lines.slice(timingIndex + 1).join('\n'));

      if (!text || Number.isNaN(start) || Number.isNaN(end) || end <= start) return [];
      return [{ start_time: start, end_time: end, text }];
    })
    .sort((a, b) => a.start_time - b.start_time);
}

export function parseSubtitleFile(content: string): TranscriptSegment[] {
  const withoutBom = content.replace(/^\uFEFF/, '');
  const withoutWebVttHeader = withoutBom.replace(/^WEBVTT[^\n]*(\n+)?/i, '');
  return parseCueBlocks(withoutWebVttHeader);
}
