/**
 * Format seconds into MM:SS or HH:MM:SS display string.
 */
export function formatTime(totalSeconds: number): string {
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

/**
 * Normalize a raw word token for vocabulary selection:
 * strips leading/trailing punctuation and converts to lowercase.
 */
export function normalizeWord(raw: string): string {
  return raw.replace(/^[.,!?;:'"()[\]{}<>]+|[.,!?;:'"()[\]{}<>]+$/g, "").toLowerCase();
}

/**
 * Strip leading/trailing punctuation from a token while preserving original casing.
 * Used when building display text for CC selections.
 */
export function stripPunctuation(raw: string): string {
  return raw.replace(/^[.,!?;:'"()[\]{}<>]+|[.,!?;:'"()[\]{}<>]+$/g, "");
}
