import { StudyRoom } from '@/components/study-room/study-room';
import { loadStudyVideoData } from '@/lib/study-room/study-video-data';
import { parseStudyMode } from '@/lib/study-room/study-mode-routing';

// ── Page ───────────────────────────────────────────────────────────────────
export default async function VideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { locale, id } = await params;
  const { mode } = await searchParams;

  const defaultMode = parseStudyMode(mode);
  const {
    videoMeta,
    videoUrl,
    segments,
    transcriptSource,
    definitions,
    ccSelections,
    dictationHtml,
  } = await loadStudyVideoData(id, locale);

  return (
    <StudyRoom
      videoId={id}
      videoMeta={videoMeta}
      videoUrl={videoUrl}
      segments={segments}
      transcriptSource={transcriptSource}
      defaultMode={defaultMode}
      initialDefinitions={definitions}
      initialCcSelections={ccSelections}
      initialDictationHtml={dictationHtml}
    />
  );
}
