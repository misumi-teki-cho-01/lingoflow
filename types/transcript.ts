/** A single selected word or phrase in CC mode (position-based, not string-based). */
export interface CcSelection {
  /** Unique key: "segIdx-wordIdx" for single word, "segIdx-startIdx-endIdx" for phrase. */
  id: string;
  segmentIndex: number;
  /** Index among non-whitespace tokens in the segment (0-based). */
  startWordIndex: number;
  /** Same as startWordIndex for a single word. */
  endWordIndex: number;
  /** The actual display text: one word or a joined phrase. */
  text: string;
}

/** Tracks an in-progress mouse-drag selection within a single segment. */
export interface DragState {
  segmentIndex: number;
  startIdx: number;
  currentIdx: number;
}

export interface TranscriptSegment {
  start_time: number;
  end_time: number;
  text: string;
}

export type TranscriptStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Transcript {
  id: string;
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
  status: TranscriptStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
