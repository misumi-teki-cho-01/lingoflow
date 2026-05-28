'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Search,
  LayoutGrid,
  List,
  Play,
  Tv2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VideoCard, type VideoCardData } from '@/components/video/video-card';
import { deleteVideo, fetchVideosPage } from '@/app/actions/videos';
import { deleteLocalVideo } from '@/lib/utils/local-media-store';
import { parseVideoEntryMode, type VideoEntryMode } from '@/lib/study-room/study-mode-routing';

const PAGE_SIZE = 24;
const ENTRY_MODE_STORAGE_KEY = 'lingoflow-dashboard-entry-mode';
const COLLAPSED_CHANNEL_COUNT = 6;

interface DashboardVideoLibraryProps {
  videos: VideoCardData[]; // initial SSR batch
}

export function DashboardVideoLibrary({ videos: initialVideos }: DashboardVideoLibraryProps) {
  const t = useTranslations('dashboard');

  // Accumulated videos across pages
  const [allVideos, setAllVideos] = useState<VideoCardData[]>(initialVideos);
  const [hasMore, setHasMore] = useState(initialVideos.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VideoCardData | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();
  // Only show the "load more" footer after the user has explicitly requested more.
  // This avoids showing "All videos loaded" to users whose library fits in one page.
  const [hasEverLoadedMore, setHasEverLoadedMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'channels'>('grid');
  const [entryMode, setEntryMode] = useState<VideoEntryMode>('cc');
  const [channelsExpanded, setChannelsExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-view-mode');
    if (saved === 'grid' || saved === 'channels') {
      setViewMode(saved);
    }
    setEntryMode(parseVideoEntryMode(localStorage.getItem(ENTRY_MODE_STORAGE_KEY)));

    const handleEntryModeChange = (event: Event) => {
      setEntryMode(parseVideoEntryMode((event as CustomEvent).detail));
    };
    window.addEventListener('lingoflow-entry-mode-change', handleEntryModeChange);
    return () => window.removeEventListener('lingoflow-entry-mode-change', handleEntryModeChange);
  }, []);

  const handleViewMode = (mode: 'grid' | 'channels') => {
    setViewMode(mode);
    localStorage.setItem('dashboard-view-mode', mode);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await fetchVideosPage(allVideos.length, PAGE_SIZE);
      setAllVideos((prev) => [...prev, ...next]);
      setHasMore(next.length >= PAGE_SIZE);
      setHasEverLoadedMore(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDeleteRequest = (video: VideoCardData) => {
    setDeleteError(null);
    setDeleteTarget(video);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    const target = deleteTarget;
    startDeleteTransition(async () => {
      const result = await deleteVideo(target.id);

      if (!result.ok) {
        setDeleteError(result.error ?? t('deleteFailed'));
        return;
      }

      if (target.source_type === 'local') {
        await deleteLocalVideo(target.video_ext_id).catch(() => undefined);
      }
      setAllVideos((prev) => prev.filter((video) => video.id !== target.id));
      setDeleteTarget(null);
      setDeleteError(null);
    });
  };

  // Derive channel list (sorted by frequency) from all loaded videos
  const channels = useMemo(() => {
    const counts = new Map<string, number>();
    allVideos.forEach((v) => {
      const ch = v.channel_name ?? '—';
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allVideos]);

  const hasHiddenChannels = channels.length > COLLAPSED_CHANNEL_COUNT;
  const visibleChannels = useMemo(() => {
    if (!hasHiddenChannels || channelsExpanded) return channels;
    const top = channels.slice(0, COLLAPSED_CHANNEL_COUNT);
    // Always keep the currently selected channel visible, even if it's outside the top N
    if (selectedChannel && !top.some((c) => c.name === selectedChannel)) {
      const selected = channels.find((c) => c.name === selectedChannel);
      if (selected) return [...top, selected];
    }
    return top;
  }, [channels, channelsExpanded, hasHiddenChannels, selectedChannel]);
  const hiddenChannelCount = channels.length - visibleChannels.length;

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    allVideos.forEach((v) => {
      counts.set(v.source_type, (counts.get(v.source_type) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allVideos]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    let result = allVideos;
    if (selectedSource) {
      result = result.filter((v) => v.source_type === selectedSource);
    }
    if (selectedChannel) {
      result = result.filter((v) => (v.channel_name ?? '—') === selectedChannel);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) => v.title?.toLowerCase().includes(q) || v.channel_name?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [allVideos, selectedSource, selectedChannel, searchQuery]);

  // Grouped by channel (for channels view)
  const groupedByChannel = useMemo(() => {
    const groups = new Map<string, VideoCardData[]>();
    filteredVideos.forEach((v) => {
      const ch = v.channel_name ?? '—';
      if (!groups.has(ch)) groups.set(ch, []);
      groups.get(ch)!.push(v);
    });
    // Sort groups by the most recent video's created_at
    return Array.from(groups.entries()).sort(([, a], [, b]) => {
      const latestA = new Date(a[0].created_at).getTime();
      const latestB = new Date(b[0].created_at).getTime();
      return latestB - latestA;
    });
  }, [filteredVideos]);

  const isEmpty = filteredVideos.length === 0;

  // "Load more" footer: show only when not actively filtering/searching
  // (search/channel filter work on loaded data — loading more only makes sense
  // when browsing all videos)
  const isFiltering = !!selectedSource || !!selectedChannel || searchQuery.trim() !== '';

  return (
    <section>
      {/* Section header */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
        <Tv2 className="h-4 w-4" />
        {t('recentImports')}
      </h2>

      {allVideos.length === 0 ? (
        /* Empty state when no videos at all */
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Play className="h-8 w-8 opacity-30" />
          </div>
          <p className="font-medium">{t('noVideos')}</p>
          <p className="text-sm mt-1 opacity-60">{t('noVideosHint')}</p>
        </div>
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-background shrink-0">
              <button
                onClick={() => handleViewMode('grid')}
                title={t('viewGrid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleViewMode('channels')}
                title={t('viewChannels')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'channels'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Source Pills ── */}
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setSelectedSource(null)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedSource === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background'
                }`}
              >
                {t('allSources')}
                <span
                  className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${
                    selectedSource === null
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {allVideos.length}
                </span>
              </button>

              {sources.map(({ name, count }) => (
                <button
                  key={name}
                  onClick={() => setSelectedSource((prev) => (prev === name ? null : name))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedSource === name
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background'
                  }`}
                >
                  <span>{t(`source.${name}`)}</span>
                  <span
                    className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${
                      selectedSource === name
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Channel Pills ── */}
          {channels.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {/* All pill */}
              <button
                onClick={() => setSelectedChannel(null)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedChannel === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background'
                }`}
              >
                {t('allChannels')}
                <span
                  className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${
                    selectedChannel === null
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {allVideos.length}
                </span>
              </button>

              {/* Per-channel pills */}
              {visibleChannels.map(({ name, count }) => (
                <button
                  key={name}
                  onClick={() => setSelectedChannel((prev) => (prev === name ? null : name))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedChannel === name
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background'
                  }`}
                >
                  <span className="max-w-[140px] truncate">{name}</span>
                  <span
                    className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${
                      selectedChannel === name
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}

              {/* Expand / collapse toggle */}
              {hasHiddenChannels && (
                <button
                  onClick={() => setChannelsExpanded((v) => !v)}
                  aria-expanded={channelsExpanded}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background transition-colors"
                >
                  {channelsExpanded ? (
                    <>
                      {t('showLessChannels')}
                      <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      {t('showMoreChannels', { count: hiddenChannelCount })}
                      <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ── Empty search / filter result ── */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Search className="h-8 w-8 opacity-30" />
              </div>
              <p className="font-medium">{t('noSearchResults')}</p>
            </div>
          )}

          {/* ── Grid view ── */}
          {!isEmpty && viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  entryMode={entryMode}
                  onDelete={handleDeleteRequest}
                  isDeleting={isDeletePending && deleteTarget?.id === video.id}
                />
              ))}
            </div>
          )}

          {/* ── Channels view ── */}
          {!isEmpty && viewMode === 'channels' && (
            <div className="flex flex-col gap-8">
              {groupedByChannel.map(([channelName, channelVideos]) => (
                <div key={channelName}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {t('channelGroup', {
                      name: channelName,
                      count: channelVideos.length,
                    })}
                  </h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                    {channelVideos.map((video) => (
                      <div key={video.id} className="w-[240px] shrink-0">
                        <VideoCard
                          video={video}
                          entryMode={entryMode}
                          onDelete={handleDeleteRequest}
                          isDeleting={isDeletePending && deleteTarget?.id === video.id}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Load more / end of list ── */}
          {!isFiltering && (hasMore || hasEverLoadedMore) && (
            <div className="flex justify-center mt-10">
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('loadingMore')}
                    </>
                  ) : (
                    t('loadMore')
                  )}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground/50">{t('noMoreVideos')}</p>
              )}
            </div>
          )}
        </>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-video-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="delete-video-title" className="text-base font-semibold text-foreground">
                  {t('deleteConfirmTitle')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t('deleteConfirmBody', {
                    title: deleteTarget.title ?? deleteTarget.video_ext_id,
                  })}
                </p>
                {deleteError && <p className="mt-3 text-sm text-destructive">{deleteError}</p>}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeletePending}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {t('deleteCancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletePending}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isDeletePending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeletePending ? t('deletingVideo') : t('deleteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
