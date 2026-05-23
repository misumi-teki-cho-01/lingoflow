'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useVideoPlayer } from '@/hooks/use-video-player';
import { useTranscriptSync } from '@/hooks/use-transcript-sync';
import { useVocabularyReview } from '@/hooks/use-vocabulary-review';
import { VideoControls } from '@/components/video/video-controls';
import { TranscriptPanel } from '@/components/transcript/transcript-panel';
import { SubtitleUploadPanel } from '@/components/transcript/subtitle-upload-panel';
import { FillPanel } from '@/components/fill/fill-panel';
import { EchoEditor } from '@/components/scribe/echo-editor';
import { VocabularyReviewModal } from './vocabulary-review-modal';
import { SubtitleEnhanceModal } from './subtitle-enhance-modal';
import { VideoSessionHeader } from './video-session-header';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { LogoutButton } from '@/components/layout/logout-button';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { Button } from '@/components/ui/button';
import { DASH_SEPARATOR_REGEX, stripPunctuation } from '@/lib/utils/format';
import type { StudyMode } from '@/lib/study-room/study-mode-routing';
import {
  convertToMarkdown,
  convertTranscriptToMarkdownWithHighlights,
  type ExportMetadata,
} from '@/lib/utils/markdown';
import { saveEnhancedTranscript } from '@/lib/api/transcripts';
import { getInstantLookupPrompt } from '@/lib/ai/prompts';
import type { TranscriptSegment, CcSelection, DragState } from '@/types/transcript';
import type { TranscriptSource } from '@/lib/pipeline/transcription-pipeline';
import type { VideoMeta } from '@/lib/utils/video-meta';
import type { VocabularyExplanation } from '@/lib/ai/services';
import { Eye, EyeOff, Sparkles, CheckCircle2, TriangleAlert, Wand2, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
export interface StudyRoomProps {
  videoId: string;
  videoMeta: VideoMeta;
  videoUrl: string;
  segments: TranscriptSegment[];
  initialDefinitions?: Record<string, VocabularyExplanation>;
  initialCcSelections?: CcSelection[];
  initialDictationHtml?: string | null;
  transcriptSource?: TranscriptSource;
  transcriptError?: string;
  defaultMode?: StudyMode;
}

type FeedbackState = {
  tone: 'success' | 'error' | 'info';
  text: string;
} | null;

const INSTANT_LOOKUP_STORAGE_KEY = 'cc-instant-lookup-disabled';

// ── Helpers ────────────────────────────────────────────────────────────────
function pushModeToUrl(mode: StudyMode) {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  window.history.replaceState({}, '', url.toString());
}

function buildSelectionContext(segments: TranscriptSegment[], selections: CcSelection[]) {
  const selectionsBySegment = new Map<number, CcSelection[]>();
  selections.forEach((selection) => {
    const group = selectionsBySegment.get(selection.segmentIndex) ?? [];
    group.push(selection);
    selectionsBySegment.set(selection.segmentIndex, group);
  });

  const markSelectedWords = (text: string, segmentSelections: CcSelection[]) => {
    const tokens = text.split(/(\s+)/);
    let wordIdx = 0;
    let marked = '';
    let isInsideSelection = false;

    tokens.forEach((token) => {
      if (/^\s+$/.test(token)) {
        marked += token;
        return;
      }

      const selected = segmentSelections.some(
        (selection) => wordIdx >= selection.startWordIndex && wordIdx <= selection.endWordIndex,
      );
      if (selected && !isInsideSelection) {
        marked += '**';
        isInsideSelection = true;
      }
      if (!selected && isInsideSelection) {
        marked += '**';
        isInsideSelection = false;
      }

      marked += token;
      wordIdx += 1;
    });

    if (isInsideSelection) marked += '**';
    return marked;
  };

  return Array.from(selectionsBySegment.entries())
    .sort(([a], [b]) => a - b)
    .map(([segmentIndex, segmentSelections]) => {
      const segment = segments[segmentIndex];
      if (!segment) return '';

      const sortedSelections = [...segmentSelections].sort(
        (a, b) => a.startWordIndex - b.startWordIndex,
      );
      return markSelectedWords(segment.text, sortedSelections);
    })
    .filter(Boolean)
    .map((sentence, index) => `${index + 1}. ${sentence}`)
    .join('\n');
}

// ── Component ──────────────────────────────────────────────────────────────
export function StudyRoom({
  videoId,
  videoMeta,
  videoUrl,
  segments: initialSegments,
  initialDefinitions = {},
  initialCcSelections = [],
  initialDictationHtml = null,
  transcriptSource,
  transcriptError,
  defaultMode = 'cc',
}: StudyRoomProps) {
  const t = useTranslations('studyRoom');

  const [mode, setMode] = useState<StudyMode>(defaultMode);
  const [showCC, setShowCC] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((next: FeedbackState) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(next);
    if (next?.tone === 'success') {
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
    }
  }, []);

  // Live segments (can be updated after AI enhancement)
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [currentTranscriptSource, setCurrentTranscriptSource] = useState<
    TranscriptSource | undefined
  >(transcriptSource);
  // Keep a stable reference to the original segments for "re-enhance from raw" option
  const rawSegmentsRef = useRef<TranscriptSegment[]>(initialSegments);

  // CC mode — position-based selections + drag state
  const [ccSelections, setCcSelections] = useState<CcSelection[]>([]);
  const [persistedCcSelections, setPersistedCcSelections] =
    useState<CcSelection[]>(initialCcSelections);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [suppressInstantLookup, setSuppressInstantLookup] = useState(false);
  const [pendingInstantSelection, setPendingInstantSelection] = useState<CcSelection | null>(null);
  const [instantReviewSelections, setInstantReviewSelections] = useState<CcSelection[]>([]);

  useEffect(() => {
    try {
      setSuppressInstantLookup(localStorage.getItem(INSTANT_LOOKUP_STORAGE_KEY) === 'true');
    } catch {
      /* ignore storage access issues */
    }
  }, []);

  const handleSuppressInstantLookupChange = useCallback((checked: boolean) => {
    setSuppressInstantLookup(checked);
    try {
      localStorage.setItem(INSTANT_LOOKUP_STORAGE_KEY, String(checked));
    } catch {
      /* ignore storage access issues */
    }
  }, []);

  // Derived: set of "segIdx-wordIdx" keys for fast per-instance highlight lookup
  const draftSelectedPositionKeys = useMemo(() => {
    const keys = new Set<string>();
    ccSelections.forEach((sel) => {
      for (let i = sel.startWordIndex; i <= sel.endWordIndex; i++) {
        keys.add(`${sel.segmentIndex}-${i}`);
      }
    });
    return keys;
  }, [ccSelections]);

  // Derived: posKey → current selected text. May be a sub-word of the original
  // token after cycling (e.g. "known" when the user has clicked "well-known" twice).
  const draftSelectedTextMap = useMemo(() => {
    const map = new Map<string, string>();
    ccSelections.forEach((sel) => {
      for (let i = sel.startWordIndex; i <= sel.endWordIndex; i++) {
        map.set(`${sel.segmentIndex}-${i}`, sel.text);
      }
    });
    return map;
  }, [ccSelections]);

  // ── CC selection persistence ──────────────────────────────────────────────
  const CC_STORAGE_KEY = `cc-selections-${videoId}`;

  // Load saved selections on mount.
  // localStorage takes priority; if empty, persistedCcSelections (from DB) fills the display.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CC_STORAGE_KEY);
      if (saved) setCcSelections(JSON.parse(saved));
    } catch {
      /* ignore corrupt data */
    }
  }, [CC_STORAGE_KEY]);

  // Save draft selections on every change (debounced 500 ms).
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(ccSelections));
    }, 500);
    return () => clearTimeout(timer);
  }, [ccSelections, CC_STORAGE_KEY]);

  // Enhancement modal
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);

  // Vocabulary review (shared hook)
  const {
    showReviewModal,
    selectedWords,
    reviewStep,
    definitions,
    openReview,
    closeReview,
    setDefinitions,
  } = useVocabularyReview(initialDefinitions);

  // Derived: position-keyed definition map — only positions explicitly marked in
  // saved or draft CC selections that also have a saved definition get an indicator.
  // This restricts definition underlines to the SPECIFIC marked occurrence rather
  // than every occurrence of the same word across the transcript.
  const definitionPositionMap = useMemo(() => {
    const map = new Map<string, VocabularyExplanation>();
    [...persistedCcSelections, ...ccSelections].forEach((sel) => {
      const key = sel.text.trim().toLowerCase();
      const def = definitions[key] ?? definitions[sel.text.trim()];
      if (def) {
        for (let i = sel.startWordIndex; i <= sel.endWordIndex; i++) {
          map.set(`${sel.segmentIndex}-${i}`, def);
        }
      }
    });
    return map;
  }, [persistedCcSelections, ccSelections, definitions]);

  const persistedSelectedPositionKeys = useMemo(() => {
    const keys = new Set<string>();
    persistedCcSelections.forEach((sel) => {
      for (let i = sel.startWordIndex; i <= sel.endWordIndex; i++) {
        keys.add(`${sel.segmentIndex}-${i}`);
      }
    });
    return keys;
  }, [persistedCcSelections]);

  const persistedSelectedTextMap = useMemo(() => {
    const map = new Map<string, string>();
    persistedCcSelections.forEach((sel) => {
      for (let i = sel.startWordIndex; i <= sel.endWordIndex; i++) {
        map.set(`${sel.segmentIndex}-${i}`, sel.text);
      }
    });
    return map;
  }, [persistedCcSelections]);

  const displayPositionKeys = useMemo(() => {
    const keys = new Set<string>(persistedSelectedPositionKeys);
    draftSelectedPositionKeys.forEach((key) => keys.add(key));
    return keys;
  }, [persistedSelectedPositionKeys, draftSelectedPositionKeys]);

  const displayTextMap = useMemo(() => {
    const map = new Map<string, string>(persistedSelectedTextMap);
    draftSelectedTextMap.forEach((value, key) => map.set(key, value));
    return map;
  }, [persistedSelectedTextMap, draftSelectedTextMap]);

  // ── Player ────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useVideoPlayer({ containerRef, videoUrl });
  const { activeSegment, activeSegmentIndex } = useTranscriptSync(liveSegments, player.currentTime);

  // ── Editor ref ────────────────────────────────────────────────────────────
  const editorRef = useRef<import('@/components/scribe/echo-editor').EchoEditorHandle>(null);

  // ── Stable player refs (for keyboard handler) ─────────────────────────────
  const playerSeekRef = useRef(player.seekTo);
  playerSeekRef.current = player.seekTo;
  const playerPauseRef = useRef(player.pause);
  playerPauseRef.current = player.pause;
  const playerPlayRef = useRef(player.play);
  playerPlayRef.current = player.play;
  const playerStateRef = useRef(player.playerState);
  const activeSegmentIndexRef = useRef(activeSegmentIndex);

  useEffect(() => {
    playerStateRef.current = player.playerState;
  }, [player.playerState]);

  useEffect(() => {
    activeSegmentIndexRef.current = activeSegmentIndex;
  }, [activeSegmentIndex]);

  const playFromSegment = useCallback((time: number, isActive: boolean) => {
    if (isActive && playerStateRef.current === 'playing') {
      playerPauseRef.current();
      return;
    }

    playerSeekRef.current(time);
    playerPlayRef.current();
  }, []);

  const [loopSegmentIndex, setLoopSegmentIndex] = useState<number | null>(null);
  const loopSeekTimestampRef = useRef(0);
  const isLoopLocked = loopSegmentIndex !== null;

  const toggleCurrentLineLoop = useCallback(() => {
    setLoopSegmentIndex((current) => {
      if (current !== null) return null;
      const nextIndex = activeSegmentIndexRef.current;
      if (nextIndex < 0) return null;
      return nextIndex;
    });
  }, []);

  useEffect(() => {
    if (loopSegmentIndex === null) return;
    if (!liveSegments[loopSegmentIndex]) {
      setLoopSegmentIndex(null);
    }
  }, [liveSegments, loopSegmentIndex]);

  useEffect(() => {
    if (loopSegmentIndex === null || player.playerState !== 'playing') return;

    const segment = liveSegments[loopSegmentIndex];
    if (!segment) return;

    const now = Date.now();
    const outsideLockedSegment =
      player.currentTime < segment.start_time - 0.15 ||
      player.currentTime >= segment.end_time - 0.05;

    if (!outsideLockedSegment || now - loopSeekTimestampRef.current < 250) return;

    loopSeekTimestampRef.current = now;
    playerSeekRef.current(segment.start_time);
    playerPlayRef.current();
  }, [liveSegments, loopSegmentIndex, player.currentTime, player.playerState]);

  // ── Shared export metadata ─────────────────────────────────────────────────
  const exportMeta = useMemo(
    (): ExportMetadata => ({
      title: videoMeta.title || `YouTube · ${videoId}`,
      url: videoUrl,
      channelName: videoMeta.channelName || undefined,
      date: new Date().toLocaleDateString(),
    }),
    [videoMeta, videoId, videoUrl],
  );

  // ── Mode change ───────────────────────────────────────────────────────────
  const handleModeChange = useCallback((next: StudyMode) => {
    setMode(next);
    pushModeToUrl(next);
    // Clear CC selections only when switching away from both cc and fill modes
    if (next !== 'cc' && next !== 'fill') {
      setCcSelections([]);
      setDragState(null);
    }
  }, []);

  // ── Global keyboard shortcuts (Scribe mode only) ───────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditor = target.contentEditable === 'true';
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (isEditor || isInput || e.repeat) return;

      if (mode === 'cc' && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleCurrentLineLoop();
        return;
      }

      if (mode === 'scribe' && e.key === 'Enter') {
        e.preventDefault();
        playerPauseRef.current();
        document.querySelector<HTMLElement>('.ProseMirror')?.focus();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, toggleCurrentLineLoop]);

  // ── Context text providers (for VocabularyReviewModal) ────────────────────
  const getScribeContextText = useCallback(async (): Promise<string> => {
    const html = editorRef.current?.getHtml() ?? '';
    return convertToMarkdown(html, exportMeta);
  }, [exportMeta]);

  const getCCContextText = useCallback(async (): Promise<string> => {
    return convertTranscriptToMarkdownWithHighlights(liveSegments, exportMeta, ccSelections);
  }, [liveSegments, exportMeta, ccSelections]);

  // ── CC drag selection ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((segIdx: number, wordIdx: number) => {
    setDragState({
      segmentIndex: segIdx,
      startIdx: wordIdx,
      currentIdx: wordIdx,
    });
  }, []);

  const handleDragEnter = useCallback((segIdx: number, wordIdx: number) => {
    setDragState((prev) =>
      prev?.segmentIndex === segIdx ? { ...prev, currentIdx: wordIdx } : prev,
    );
  }, []);

  const handleDragEnd = useCallback(() => {
    // Read dragState directly from closure (it's in deps) — no nested setState
    if (!dragState) return;

    const { segmentIndex, startIdx, currentIdx } = dragState;
    const minIdx = Math.min(startIdx, currentIdx);
    const maxIdx = Math.max(startIdx, currentIdx);

    const seg = liveSegments[segmentIndex];
    const nonWhitespaceTokens = seg.text.split(/(\s+)/).filter((t) => !/^\s+$/.test(t));
    // Strip leading/trailing punctuation from each token so "world." → "world"
    const phrase = nonWhitespaceTokens
      .slice(minIdx, maxIdx + 1)
      .map(stripPunctuation)
      .filter(Boolean)
      .join(' ');

    const id =
      minIdx === maxIdx ? `${segmentIndex}-${minIdx}` : `${segmentIndex}-${minIdx}-${maxIdx}`;

    // Clear drag state first so double-fire is a no-op
    setDragState(null);

    const overlaps = ccSelections.filter(
      (s) =>
        s.segmentIndex === segmentIndex && s.startWordIndex <= maxIdx && s.endWordIndex >= minIdx,
    );
    const nextSelection: CcSelection = {
      id,
      segmentIndex,
      startWordIndex: minIdx,
      endWordIndex: maxIdx,
      text: phrase,
    };

    setCcSelections((prevSels) => {
      const currentOverlaps = prevSels.filter(
        (s) =>
          s.segmentIndex === segmentIndex && s.startWordIndex <= maxIdx && s.endWordIndex >= minIdx,
      );
      // Allow deselecting (removing) even if the word has a definition
      if (currentOverlaps.length > 0) {
        // For a single-word selection on a 2-part hyphenated token, cycle
        // through {both} → {second} → {first} → {none} instead of removing.
        if (currentOverlaps.length === 1 && minIdx === maxIdx) {
          const sel = currentOverlaps[0];
          const originalToken = stripPunctuation(nonWhitespaceTokens[minIdx]);
          const parts = originalToken.split(DASH_SEPARATOR_REGEX);
          if (parts.length === 2) {
            const [first, second] = parts;
            const cur = sel.text.toLowerCase();
            let next: string | null = null;
            if (cur === originalToken.toLowerCase()) next = second;
            else if (cur === second.toLowerCase()) next = first;
            // else: cur === first → next stays null → remove
            if (next === null) {
              return prevSels.filter((s) => s !== sel);
            }
            return prevSels.map((s) => (s === sel ? { ...s, text: next as string } : s));
          }
        }
        return prevSels.filter((s) => !currentOverlaps.includes(s));
      }
      return [...prevSels, nextSelection];
    });

    if (overlaps.length === 0 && phrase && !suppressInstantLookup) {
      setPendingInstantSelection(nextSelection);
    }
  }, [ccSelections, dragState, liveSegments, suppressInstantLookup]);

  const handleCCWordsClear = useCallback(() => {
    setCcSelections([]);
    setPendingInstantSelection(null);
    localStorage.removeItem(`cc-selections-${videoId}`);
  }, [videoId]);

  const removeCcSelection = useCallback((selection: CcSelection) => {
    setCcSelections((prev) => prev.filter((sel) => sel.id !== selection.id));
    setPendingInstantSelection((prev) => (prev?.id === selection.id ? null : prev));
  }, []);

  const getUnexplainedCcSelections = useCallback(() => {
    return ccSelections.filter((sel) => {
      const key = sel.text.trim().toLowerCase();
      return definitions[key] === undefined && definitions[sel.text.trim()] === undefined;
    });
  }, [ccSelections, definitions]);

  // ── Vocabulary review — Scribe ────────────────────────────────────────────
  const openScribeVocabularyReview = () => {
    if (!editorRef.current) return;
    const words = editorRef.current.getHighlightedWords();
    if (words.length === 0) {
      showFeedback({ tone: 'error', text: t('noVocabularySelected') });
      return;
    }
    openReview(words);
  };

  // ── Vocabulary review — CC ─────────────────────────────────────────────────
  const openCCVocabularyReview = useCallback(() => {
    if (ccSelections.length === 0) return;
    // Only queue words that don't already have a saved definition for review.
    // Words with existing definitions are still highlighted but need no new lookup.
    const words = ccSelections
      .filter((sel) => {
        const key = sel.text.trim().toLowerCase();
        return definitions[key] === undefined && definitions[sel.text.trim()] === undefined;
      })
      .map((sel) => ({ id: sel.id, text: sel.text }));
    if (words.length === 0) return;
    openReview(words);
  }, [ccSelections, definitions, openReview]);

  // ── Save vocabulary — Scribe ──────────────────────────────────────────────
  const handleSaveScribeVocabulary = async (
    finalData: Record<string, VocabularyExplanation>,
    transforms: { id: string; newText: string }[],
    options: { persistReviewedTranscript: boolean },
  ) => {
    const { saveVocabularyToDB } = await import('@/lib/api/ai');
    await saveVocabularyToDB(videoId, finalData, {
      sourceMode: 'scribe',
      dictation: options.persistReviewedTranscript
        ? {
            contentHtml: editorRef.current?.getHtml() ?? '',
            segments: editorRef.current?.getTranscriptSegments() ?? [],
          }
        : undefined,
    });

    if (editorRef.current && transforms.length > 0) {
      transforms.forEach((tr) => {
        editorRef.current!.updateHighlightedWord(tr.id, tr.newText);
      });
    }

    setDefinitions((prev) => ({ ...prev, ...finalData }));
    showFeedback({ tone: 'success', text: t('saveSuccess') });
    closeReview();
  };

  // ── Save vocabulary — CC ──────────────────────────────────────────────────
  const handleSaveCCVocabulary = async (
    finalData: Record<string, VocabularyExplanation>,
    transforms: { id: string; newText: string }[],
    options: { persistReviewedTranscript: boolean },
  ) => {
    void transforms;
    void options;
    const { saveVocabularyToDB } = await import('@/lib/api/ai');
    // Merge existing definitions so the server can resolve vocabulary_id
    // for selections that already had a saved definition (and were not re-reviewed).
    await saveVocabularyToDB(
      videoId,
      { ...definitions, ...finalData },
      {
        sourceMode: 'cc',
        ccSelections,
      },
    );
    setDefinitions((prev) => ({ ...prev, ...finalData }));
    setPersistedCcSelections((prev) => {
      const merged = new Map<string, CcSelection>();
      [...prev, ...ccSelections].forEach((sel) => merged.set(sel.id, sel));
      return Array.from(merged.values());
    });
    setCcSelections([]);
    localStorage.removeItem(`cc-selections-${videoId}`);
    showFeedback({ tone: 'success', text: t('saveSuccess') });
    closeReview();
  };

  const handleSaveInstantCCVocabulary = async (
    finalData: Record<string, VocabularyExplanation>,
    transforms: { id: string; newText: string }[],
    options: { persistReviewedTranscript: boolean },
  ) => {
    void options;
    if (instantReviewSelections.length === 0) return;

    const finalDataByText = new Map<string, VocabularyExplanation>();
    Object.values(finalData).forEach((def) => {
      finalDataByText.set(def.original_text.trim(), def);
      finalDataByText.set(def.original_text.trim().toLowerCase(), def);
    });

    const savedSelections = instantReviewSelections
      .map((selection) => {
        const transformed = transforms.find((tr) => tr.id === selection.id);
        const transformedText = transformed?.newText ?? selection.text;
        const def =
          finalDataByText.get(transformedText.trim()) ??
          finalDataByText.get(transformedText.trim().toLowerCase());
        if (!def) return null;

        return {
          ...selection,
          text: def.original_text,
        };
      })
      .filter((selection): selection is CcSelection => selection !== null);

    if (savedSelections.length === 0) return;

    const { saveVocabularyToDB } = await import('@/lib/api/ai');
    await saveVocabularyToDB(videoId, finalData, {
      sourceMode: 'cc',
      ccSelections: savedSelections,
    });

    setDefinitions((prev) => ({ ...prev, ...finalData }));
    setPersistedCcSelections((prev) => {
      const merged = new Map<string, CcSelection>();
      [...prev, ...savedSelections].forEach((sel) => merged.set(sel.id, sel));
      return Array.from(merged.values());
    });
    const savedIds = new Set(savedSelections.map((sel) => sel.id));
    setCcSelections((prev) => prev.filter((sel) => !savedIds.has(sel.id)));
    setInstantReviewSelections([]);
    showFeedback({ tone: 'success', text: t('saveSuccess') });
  };

  const instantReviewWords = useMemo(
    () => instantReviewSelections.map((sel) => ({ id: sel.id, text: sel.text })),
    [instantReviewSelections],
  );

  const getInstantContextText = useCallback(
    () => Promise.resolve(buildSelectionContext(liveSegments, instantReviewSelections)),
    [instantReviewSelections, liveSegments],
  );

  // ── Save enhanced subtitles ───────────────────────────────────────────────
  const handleSaveEnhancedTranscript = async (enhanced: TranscriptSegment[]) => {
    await saveEnhancedTranscript(videoId, enhanced);
    setLiveSegments(enhanced);
    setCurrentTranscriptSource('subtitle-enhanced');
    setShowEnhanceModal(false);
    showFeedback({ tone: 'success', text: t('enhanceSaveSuccess') });
  };

  const handleSubtitleUploaded = (segments: TranscriptSegment[]) => {
    setLiveSegments(segments);
    rawSegmentsRef.current = segments;
    setCurrentTranscriptSource('subtitle-raw');
    setCcSelections([]);
    setPersistedCcSelections([]);
    localStorage.removeItem(`cc-selections-${videoId}`);
    showFeedback({ tone: 'success', text: t('subtitleUploadSuccess') });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <VideoSessionHeader
        videoId={videoId}
        title={videoMeta.title}
        activeMode={mode}
        onStudyModeChange={handleModeChange}
        actions={
          <>
            {mode === 'scribe' && (
              <Button
                variant="outline"
                size="sm"
                onClick={openScribeVocabularyReview}
                className="h-8 gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('aiExplain')}
              </Button>
            )}

            {mode === 'cc' && (
              <>
                {ccSelections.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openCCVocabularyReview}
                    className="h-8 gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('aiExplain')} ({ccSelections.length})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEnhanceModal(true)}
                  className="h-8 gap-1.5 text-xs text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 border-violet-200 dark:border-violet-500/30"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {t('enhanceSubtitles')}
                </Button>
              </>
            )}

            {mode === 'fill' && ccSelections.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={openCCVocabularyReview}
                className="h-8 gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('aiExplain')} ({ccSelections.length})
              </Button>
            )}
          </>
        }
        trailing={
          <>
            <ThemeSwitcher />
            <LocaleSwitcher />
            <LogoutButton />
          </>
        }
      />

      {/* ── Feedback banner ── */}
      {feedback && (
        <div className="px-4 pt-3 shrink-0">
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
              feedback.tone === 'success'
                ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                : feedback.tone === 'error'
                  ? 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-200'
            }`}
          >
            {feedback.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 overflow-hidden">
        {/* Left — video + controls + (Scribe only: CC overlay + hints) */}
        <section className="flex flex-col p-4 gap-3 min-h-0 border-r border-border/50 overflow-hidden">
          {/* Video info bar */}
          {(videoMeta.title || videoMeta.channelName) && (
            <div className="shrink-0 px-1">
              {videoMeta.title && (
                <h1 className="text-sm font-semibold leading-tight line-clamp-1">
                  {videoMeta.title}
                </h1>
              )}
              {videoMeta.channelName && (
                <p className="text-xs text-muted-foreground mt-0.5">{videoMeta.channelName}</p>
              )}
            </div>
          )}

          {/* Player */}
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg ring-1 ring-white/10 shrink-0">
            <div ref={containerRef} className="h-full w-full" />
          </div>

          {/* Controls */}
          <VideoControls player={player} />

          {/* Scribe-mode extras */}
          {mode === 'scribe' && (
            <>
              {/* CC overlay (toggleable) */}
              <div
                className={`rounded-xl border border-dashed border-border p-4 flex flex-col items-center justify-center text-center min-h-[80px] transition-all duration-300 ${
                  showCC ? 'bg-card opacity-100' : 'bg-muted/5 opacity-40'
                }`}
              >
                {!showCC ? (
                  <p className="text-xs text-muted-foreground">{t('ccHidden')}</p>
                ) : activeSegment ? (
                  <p className="text-base font-medium leading-relaxed animate-in fade-in">
                    {activeSegment.text}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t('ccNoSubtitle')}</p>
                )}
              </div>

              {/* Shortcut legends + CC toggle */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                      Enter
                    </kbd>
                    {t('shortcutPause')}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                      Shift+Enter
                    </kbd>
                    {t('shortcutResume')}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCC((v) => !v)}
                  className="h-7 text-xs gap-1 px-2"
                >
                  {showCC ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showCC ? t('hideCC') : t('showCC')}
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Right — mode-specific panel */}
        <section className="p-4 flex flex-col min-h-0 overflow-hidden">
          {liveSegments.length === 0 ? (
            <SubtitleUploadPanel videoId={videoId} onUploaded={handleSubtitleUploaded} />
          ) : mode === 'scribe' ? (
            <EchoEditor
              ref={editorRef}
              className="flex-1 min-h-0"
              onCommit={() => playerPlayRef.current()}
              currentTime={player.currentTime}
              draftKey={videoId}
              initialContent={initialDictationHtml}
              definitions={definitions}
            />
          ) : mode === 'cc' ? (
            <TranscriptPanel
              segments={liveSegments}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentClick={player.seekTo}
              onSegmentPlay={playFromSegment}
              isPlaying={player.playerState === 'playing'}
              source={currentTranscriptSource}
              errorMessage={transcriptError}
              wordClickMode
              selectedPositionKeys={displayPositionKeys}
              selectedTextMap={displayTextMap}
              selectionCount={ccSelections.length}
              definitions={definitions}
              definitionPositionMap={definitionPositionMap}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onClearWords={handleCCWordsClear}
              onExplainWords={openCCVocabularyReview}
              suppressInstantLookup={suppressInstantLookup}
              onSuppressInstantLookupChange={handleSuppressInstantLookupChange}
              isLoopLocked={isLoopLocked}
              onToggleLoopLock={toggleCurrentLineLoop}
            />
          ) : (
            <FillPanel
              segments={liveSegments}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentClick={player.seekTo}
              errorMessage={transcriptError}
              selectedPositionKeys={displayPositionKeys}
              selectionCount={ccSelections.length}
              definitions={definitions}
              definitionPositionMap={definitionPositionMap}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onClearWords={handleCCWordsClear}
              onExplainWords={openCCVocabularyReview}
            />
          )}
        </section>
      </main>

      {/* ── Vocabulary Review Modal ── */}
      <VocabularyReviewModal
        visible={showReviewModal}
        initialWords={selectedWords}
        initialStep={reviewStep}
        onCancel={closeReview}
        onSave={mode === 'scribe' ? handleSaveScribeVocabulary : handleSaveCCVocabulary}
        getContextText={mode === 'scribe' ? getScribeContextText : getCCContextText}
        showPersistOption={mode === 'scribe'}
        onFeedback={showFeedback}
        existingDefinitions={mode !== 'scribe' ? definitions : undefined}
      />

      {instantReviewSelections.length > 0 && (
        <VocabularyReviewModal
          visible
          initialWords={instantReviewWords}
          initialStep="prompt_editor"
          onCancel={() => setInstantReviewSelections([])}
          onSave={handleSaveInstantCCVocabulary}
          getContextText={getInstantContextText}
          promptBuilder={getInstantLookupPrompt}
          showPersistOption={false}
          onFeedback={showFeedback}
          existingDefinitions={definitions}
        />
      )}

      {pendingInstantSelection && instantReviewSelections.length === 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('instantLookupTitle')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('instantLookupDesc', { word: pendingInstantSelection.text })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setPendingInstantSelection(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => removeCcSelection(pendingInstantSelection)}>
                {t('cancelAnnotation')}
              </Button>
              <Button
                onClick={() => {
                  const unexplainedSelections = getUnexplainedCcSelections();
                  setInstantReviewSelections(
                    unexplainedSelections.length > 0
                      ? unexplainedSelections
                      : [pendingInstantSelection],
                  );
                  setPendingInstantSelection(null);
                }}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t('lookupThisWord')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Subtitle Enhancement Modal ── */}
      <SubtitleEnhanceModal
        visible={showEnhanceModal}
        segments={liveSegments}
        rawSegments={rawSegmentsRef.current}
        onCancel={() => setShowEnhanceModal(false)}
        onSave={handleSaveEnhancedTranscript}
      />
    </div>
  );
}
