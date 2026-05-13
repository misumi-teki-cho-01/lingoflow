'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { importVideo, type ImportVideoState } from '@/app/actions/import-video';
import { useRouter } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { parseSubtitleFile } from '@/lib/utils/subtitle-parser';
import {
  createLocalVideoId,
  deleteLocalVideo,
  saveLocalVideo,
} from '@/lib/utils/local-media-store';
import { uploadTranscript } from '@/lib/api/transcripts';
import { Loader2, ArrowRight, FileVideo, FileText } from 'lucide-react';

const INITIAL_STATE: ImportVideoState = {};
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['mp4', 'webm']);

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration);
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      finish(duration);
    };
    video.onerror = () => {
      finish(null);
    };
    video.src = url;
  });
}

export function VideoImportForm() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<'url' | 'local'>('url');
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
  const [localSubtitleFile, setLocalSubtitleFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLocalPending, setIsLocalPending] = useState(false);

  // Server Action error codes → i18n strings
  const ERROR_MESSAGES: Record<string, string> = {
    invalidUrl: t('errorInvalidUrl'),
    noSubtitles: t('errorNoSubtitles'),
    saveFailed: t('errorSaveFailed'),
  };

  // Bind locale into the server action
  const importWithLocale = importVideo.bind(null, locale);
  const [state, action, isPending] = useActionState(importWithLocale, INITIAL_STATE);

  // Auto-focus input on mount
  const inputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === 'url') inputRef.current?.focus();
  }, [mode]);

  const handleLocalImport = async () => {
    setLocalError(null);
    if (!localVideoFile) {
      setLocalError(t('localVideoRequired'));
      return;
    }

    const videoExt = getFileExtension(localVideoFile.name);
    if (!SUPPORTED_VIDEO_EXTENSIONS.has(videoExt)) {
      setLocalError(t('localVideoUnsupported'));
      return;
    }

    setIsLocalPending(true);
    let videoId: string | null = null;
    try {
      videoId = createLocalVideoId();
      const duration = await readVideoDuration(localVideoFile);

      await saveLocalVideo({
        id: videoId,
        file: localVideoFile,
        name: localVideoFile.name,
        type: localVideoFile.type,
        size: localVideoFile.size,
        lastModified: localVideoFile.lastModified,
        duration: duration ?? undefined,
        createdAt: new Date().toISOString(),
      });

      const res = await fetch('/api/videos/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          title: localVideoFile.name.replace(/\.[^.]+$/, ''),
          duration,
          mimeType: localVideoFile.type,
          size: localVideoFile.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('errorSaveFailed'));

      if (localSubtitleFile) {
        const subtitleExt = getFileExtension(localSubtitleFile.name);
        if (subtitleExt !== 'srt' && subtitleExt !== 'vtt') {
          throw new Error(t('localSubtitleUnsupported'));
        }
        const segments = parseSubtitleFile(await localSubtitleFile.text());
        if (segments.length === 0) throw new Error(t('localSubtitleParseFailed'));
        await uploadTranscript(videoId, segments);
      }

      router.push(`/video/${videoId}`);
      router.refresh();
    } catch (err) {
      if (videoId) {
        await deleteLocalVideo(videoId).catch(() => undefined);
      }
      setLocalError(err instanceof Error ? err.message : t('errorSaveFailed'));
    } finally {
      setIsLocalPending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-3 flex w-fit rounded-lg border border-border bg-background p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            mode === 'url'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('urlImportTab')}
        </button>
        <button
          type="button"
          onClick={() => setMode('local')}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            mode === 'local'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('localImportTab')}
        </button>
      </div>

      {mode === 'url' ? (
        <form action={action}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                name="url"
                type="url"
                placeholder={t('urlPlaceholder')}
                disabled={isPending}
                className={`h-11 pr-4 ${state.error ? 'border-destructive ring-destructive/20' : ''}`}
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="lg" disabled={isPending} className="shrink-0 gap-2">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('importing')}
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  {t('importVideo')}
                </>
              )}
            </Button>
          </div>

          {/* Error message */}
          {state.error && (
            <p className="mt-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
              {ERROR_MESSAGES[state.error] ?? state.error}
            </p>
          )}

          {/* Loading hint */}
          {isPending && (
            <p className="mt-2 text-sm text-muted-foreground animate-in fade-in">
              {t('importingHint')}
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-3 text-left">
          <input
            ref={videoInputRef}
            type="file"
            accept=".mp4,.webm,video/mp4,video/webm"
            className="hidden"
            onChange={(event) => {
              setLocalError(null);
              setLocalVideoFile(event.target.files?.[0] ?? null);
            }}
          />
          <input
            ref={subtitleInputRef}
            type="file"
            accept=".srt,.vtt,text/vtt"
            className="hidden"
            onChange={(event) => {
              setLocalError(null);
              setLocalSubtitleFile(event.target.files?.[0] ?? null);
            }}
          />

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start gap-2 truncate"
              disabled={isLocalPending}
              onClick={() => videoInputRef.current?.click()}
            >
              <FileVideo className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {localVideoFile ? localVideoFile.name : t('chooseLocalVideo')}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start gap-2 truncate"
              disabled={isLocalPending}
              onClick={() => subtitleInputRef.current?.click()}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {localSubtitleFile ? localSubtitleFile.name : t('chooseLocalSubtitle')}
              </span>
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-11 shrink-0 gap-2"
              disabled={isLocalPending}
              onClick={() => void handleLocalImport()}
            >
              {isLocalPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isLocalPending ? t('importing') : t('importVideo')}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">{t('localImportHint')}</p>

          {localError && (
            <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1">
              {localError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
