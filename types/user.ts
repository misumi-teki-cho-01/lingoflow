export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  nativeLanguage: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  defaultRewindDuration: number;
  autoResumeAfterRewind: boolean;
  playbackRate: number;
  transcriptFontSize: 'sm' | 'base' | 'lg' | 'xl';
  showTranslation: boolean;
}

export interface UserVideoProgress {
  id: string;
  userId: string;
  videoId: string;
  lastPosition: number;
  shadowCount: number;
  totalPracticeSeconds: number;
  segmentsPracticed: number[];
  completed: boolean;
  updatedAt: string;
}
