import { useEffect, useMemo, useState } from "react";

import {
  createVideo,
  deleteVideo,
  getVideos,
} from "../api";
import {
  PlayIcon,
  SearchIcon,
  TrashIcon,
} from "../components/Icons";
import { useApplicationsChanged } from "../events";
import type { Video } from "../types";
import { useWorkspace } from "../workspace";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");

  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${s}`
    : `${m}:${s}`;
}

function VideoThumbnail({ video }: { video: Video }) {
  const [failed, setFailed] = useState(false);
  const tooltip = video.fetch_error
    ? `Couldn't fetch video details: ${video.fetch_error}`
    : undefined;

  return (
    <div
      className={`video-thumbnail ${
        video.fetch_error ? "video-thumbnail-error" : ""
      }`}
      title={tooltip}
    >
      {video.thumbnail && !failed ? (
        <img
          src={`/static/icons/${encodeURIComponent(video.thumbnail)}`}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <PlayIcon size={20} />
      )}

      {video.duration !== null && (
        <span className="video-duration">
          {formatDuration(video.duration)}
        </span>
      )}
    </div>
  );
}

export function Videos() {
  const { id: workspace } = useWorkspace();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void loadVideos();
  }, []);

  async function loadVideos() {
    setLoading(true);
    setError(null);

    try {
      setVideos(await getVideos(workspace));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load videos",
      );
    } finally {
      setLoading(false);
    }
  }

  // Picks up fetched titles and thumbnails, and changes made elsewhere, without a loading flash.
  useApplicationsChanged(workspace, () => {
    getVideos(workspace)
      .then(setVideos)
      .catch(() => {});
  });

  const visibleVideos = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return videos;
    }

    return videos.filter((video) =>
      [video.url, video.title, video.uploader].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [videos, search]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    const url = addUrl.trim();

    if (!url) {
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const video = await createVideo(workspace, url);

      setVideos((current) =>
        current.some((item) => item.id === video.id)
          ? current
          : [...current, video],
      );
      setAddUrl("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to add video",
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(video: Video) {
    if (
      !window.confirm(
        `Delete this video?\n\n${video.title || video.url}`,
      )
    ) {
      return;
    }

    setDeleting(video.id);
    setError(null);

    try {
      await deleteVideo(workspace, video.id);

      setVideos((current) =>
        current.filter((item) => item.id !== video.id),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete video",
      );
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Videos</h1>
          <p className="page-description">
            Videos added here appear in the launcher and
            play in a standalone video player.
          </p>
        </div>

        {!loading && videos.length > 0 && (
          <div className="stats">
            <span className="stat">
              <strong>{videos.length}</strong>
              {videos.length === 1 ? " video" : " videos"}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          {error}

          <button
            type="button"
            className="alert-dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      <section className="add-site card">
        <div className="section-heading">
          <div>
            <h2>Add video</h2>
            <p>
              Paste a link to a video or playlist on any site
              supported by yt-dlp.
            </p>
          </div>
        </div>

        <form className="add-video-form" onSubmit={handleAdd}>
          <input
            type="url"
            value={addUrl}
            onChange={(event) => setAddUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-label="Video URL"
          />

          <button
            type="submit"
            className="button button-primary"
            disabled={adding || addUrl.trim().length === 0}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      </section>

      <div className="sites-search">
        <span className="search-icon">
          <SearchIcon />
        </span>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search videos…"
          aria-label="Search videos"
        />

        {search && (
          <button
            type="button"
            className="clear-search"
            onClick={() => setSearch("")}
          >
            Clear
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading videos…</div>
        ) : visibleVideos.length === 0 ? (
          <div className="empty-state">
            <PlayIcon size={28} />
            <span>
              {search
                ? "No videos matched your search."
                : "No videos yet. Add a link above to get started."}
            </span>
          </div>
        ) : (
          <div className="domain-list">
            {visibleVideos.map((video) => (
              <div className="domain" key={video.id}>
                <div className="domain-row video-row">
                  <VideoThumbnail video={video} />

                  <div className="domain-name">
                    <div className="site-url">
                      {video.title ?? (
                        <span className="muted">
                          {video.fetch_error
                            ? "Details unavailable"
                            : "Fetching details…"}
                        </span>
                      )}
                    </div>

                    {video.uploader && (
                      <div className="site-title">
                        {video.uploader}
                      </div>
                    )}

                    <div className="site-title">
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {video.url}
                      </a>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="delete-button"
                    disabled={deleting === video.id}
                    onClick={() => void handleDelete(video)}
                    aria-label={`Delete ${video.title ?? video.url}`}
                    title="Delete"
                  >
                    {deleting === video.id ? "…" : <TrashIcon />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
