/** Default rewind duration in seconds for shadow practice */
export const DEFAULT_REWIND_DURATION = 5;

/** Minimum rewind duration in seconds */
export const MIN_REWIND_DURATION = 2;

/** Maximum rewind duration in seconds */
export const MAX_REWIND_DURATION = 10;

/** Time update polling interval in ms (YouTube has no native timeupdate event) */
export const TIME_UPDATE_INTERVAL = 250;

/** Debounce threshold in ms for rapid pause/play detection */
export const PAUSE_DEBOUNCE_MS = 300;

/** Delay before auto-resume after rewind in ms */
export const AUTO_RESUME_DELAY_MS = 500;

/** Supported video sources */
export const SUPPORTED_SOURCES = ["youtube", "bilibili"] as const;
