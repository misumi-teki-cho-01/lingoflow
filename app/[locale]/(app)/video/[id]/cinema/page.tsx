import { CinemaRoom } from '@/components/study-room/cinema-room';
import { loadStudyVideoData } from '@/lib/study-room/study-video-data';

export default async function CinemaPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { videoMeta, videoUrl, segments } = await loadStudyVideoData(id, locale);

  return (
    <CinemaRoom videoId={id} title={videoMeta.title} videoUrl={videoUrl} segments={segments} />
  );
}
