export type StudyMode = 'scribe' | 'cc' | 'fill';
export type VideoEntryMode = StudyMode | 'cinema';

export const STUDY_MODES: StudyMode[] = ['cc', 'scribe', 'fill'];
export const VIDEO_ENTRY_MODES: VideoEntryMode[] = ['cc', 'scribe', 'fill', 'cinema'];

export function parseStudyMode(mode: string | undefined | null): StudyMode {
  return mode === 'scribe' || mode === 'fill' || mode === 'cc' ? mode : 'cc';
}

export function parseVideoEntryMode(mode: string | undefined | null): VideoEntryMode {
  return mode === 'scribe' || mode === 'fill' || mode === 'cinema' || mode === 'cc' ? mode : 'cc';
}

export function buildVideoModeHref(videoId: string, mode: VideoEntryMode): string {
  if (mode === 'cinema') return `/video/${videoId}/cinema`;
  return `/video/${videoId}?mode=${mode}`;
}
