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
