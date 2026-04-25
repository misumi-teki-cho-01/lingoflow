"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, LayoutGrid, List, Play, Tv2, Loader2 } from "lucide-react";
import { VideoCard, type VideoCardData } from "@/components/video/video-card";
import { fetchVideosPage } from "@/app/actions/videos";

const PAGE_SIZE = 24;

interface DashboardVideoLibraryProps {
  videos: VideoCardData[]; // initial SSR batch
}

export function DashboardVideoLibrary({ videos: initialVideos }: DashboardVideoLibraryProps) {
  const t = useTranslations("dashboard");

  // Accumulated videos across pages
  const [allVideos, setAllVideos] = useState<VideoCardData[]>(initialVideos);
  const [hasMore, setHasMore] = useState(initialVideos.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  // Only show the "load more" footer after the user has explicitly requested more.
  // This avoids showing "All videos loaded" to users whose library fits in one page.
  const [hasEverLoadedMore, setHasEverLoadedMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "channels">(() => {
    if (typeof window === "undefined") return "grid";
    const saved = localStorage.getItem("dashboard-view-mode");
    return saved === "grid" || saved === "channels" ? saved : "grid";
  });

  const handleViewMode = (mode: "grid" | "channels") => {
    setViewMode(mode);
    localStorage.setItem("dashboard-view-mode", mode);
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

  // Derive channel list (sorted by frequency) from all loaded videos
  const channels = useMemo(() => {
    const counts = new Map<string, number>();
    allVideos.forEach((v) => {
      const ch = v.channel_name ?? "—";
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allVideos]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    let result = allVideos;
    if (selectedChannel) {
      result = result.filter(
        (v) => (v.channel_name ?? "—") === selectedChannel
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.channel_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allVideos, selectedChannel, searchQuery]);

  // Grouped by channel (for channels view)
  const groupedByChannel = useMemo(() => {
    const groups = new Map<string, VideoCardData[]>();
    filteredVideos.forEach((v) => {
      const ch = v.channel_name ?? "—";
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
  const isFiltering = !!selectedChannel || searchQuery.trim() !== "";

  return (
    <section>
      {/* Section header */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
        <Tv2 className="h-4 w-4" />
        {t("recentImports")}
      </h2>

      {allVideos.length === 0 ? (
        /* Empty state when no videos at all */
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Play className="h-8 w-8 opacity-30" />
          </div>
          <p className="font-medium">{t("noVideos")}</p>
          <p className="text-sm mt-1 opacity-60">{t("noVideosHint")}</p>
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
                placeholder={t("searchPlaceholder")}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-background shrink-0">
              <button
                onClick={() => handleViewMode("grid")}
                title={t("viewGrid")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleViewMode("channels")}
                title={t("viewChannels")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "channels"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Channel Pills ── */}
          {channels.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {/* All pill */}
              <button
                onClick={() => setSelectedChannel(null)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedChannel === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background"
                }`}
              >
                {t("allChannels")}
                <span
                  className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${
                    selectedChannel === null
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {allVideos.length}
                </span>
              </button>

              {/* Per-channel pills */}
              {channels.map(({ name, count }) => (
                <button
                  key={name}
                  onClick={() =>
                    setSelectedChannel((prev) => (prev === name ? null : name))
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedChannel === name
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background"
                  }`}
                >
                  <span className="max-w-[140px] truncate">{name}</span>
                  <span
                    className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${
                      selectedChannel === name
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Empty search / filter result ── */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Search className="h-8 w-8 opacity-30" />
              </div>
              <p className="font-medium">{t("noSearchResults")}</p>
            </div>
          )}

          {/* ── Grid view ── */}
          {!isEmpty && viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video) => (
                <VideoCard key={video.video_ext_id} video={video} />
              ))}
            </div>
          )}

          {/* ── Channels view ── */}
          {!isEmpty && viewMode === "channels" && (
            <div className="flex flex-col gap-8">
              {groupedByChannel.map(([channelName, channelVideos]) => (
                <div key={channelName}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {t("channelGroup", {
                      name: channelName,
                      count: channelVideos.length,
                    })}
                  </h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                    {channelVideos.map((video) => (
                      <div
                        key={video.video_ext_id}
                        className="w-[240px] shrink-0"
                      >
                        <VideoCard video={video} />
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
                      {t("loadingMore")}
                    </>
                  ) : (
                    t("loadMore")
                  )}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground/50">
                  {t("noMoreVideos")}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
