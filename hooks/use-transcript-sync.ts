"use client";

import { useMemo } from "react";
import type { TranscriptSegment } from "@/types/transcript";

interface TranscriptSyncResult {
  activeSegmentIndex: number;
  activeSegment: TranscriptSegment | null;
}

/**
 * Binary search to find the active transcript segment for a given time.
 * Segments must be sorted by start_time (ascending).
 */
function findActiveSegment(
  segments: TranscriptSegment[],
  currentTime: number,
): number {
  if (segments.length === 0) return -1;

  let low = 0;
  let high = segments.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (segments[mid].start_time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Verify the found segment's end_time contains currentTime
  if (result >= 0 && currentTime < segments[result].end_time) {
    return result;
  }

  return -1;
}

export function useTranscriptSync(
  segments: TranscriptSegment[],
  currentTime: number,
): TranscriptSyncResult {
  return useMemo(() => {
    const index = findActiveSegment(segments, currentTime);
    return {
      activeSegmentIndex: index,
      activeSegment: index >= 0 ? segments[index] : null,
    };
  }, [segments, currentTime]);
}
