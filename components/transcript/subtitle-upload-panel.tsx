'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, Loader2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { parseSubtitleFile } from '@/lib/utils/subtitle-parser';
import { uploadTranscript } from '@/lib/api/transcripts';
import type { TranscriptSegment } from '@/types/transcript';

interface SubtitleUploadPanelProps {
  videoId: string;
  onUploaded: (segments: TranscriptSegment[]) => void;
}

export function SubtitleUploadPanel({ videoId, onUploaded }: SubtitleUploadPanelProps) {
  const t = useTranslations('transcript');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'srt' && ext !== 'vtt') {
        throw new Error(t('uploadUnsupported'));
      }

      const text = await file.text();
      const segments = parseSubtitleFile(text);
      if (segments.length === 0) {
        throw new Error(t('uploadParseFailed'));
      }

      await uploadTranscript(videoId, segments);
      onUploaded(segments);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
      <div className="rounded-full bg-muted p-5">
        <FileText className="h-10 w-10 text-muted-foreground/50" />
      </div>

      <div className="mt-4 max-w-sm">
        <h3 className="text-base font-semibold">{t('uploadTitle')}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('uploadDesc')}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".srt,.vtt,text/vtt"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <Button
        type="button"
        className="mt-5 gap-2 rounded-full"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isUploading ? t('uploading') : t('uploadButton')}
      </Button>

      <p className="mt-3 text-xs text-muted-foreground">{t('uploadFormatHint')}</p>

      {error && (
        <div className="mt-4 flex max-w-sm items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
