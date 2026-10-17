/**
 * Discover — the logged-in "home" feed: search, filter, browse a grid of
 * profiles, click one to open the like/pass modal.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ POSTDATE!             HOME  MESSAGES  PROFILE    │  AppNav (Home active)
 *   ├──────────────────────────────────────────────────┤
 *   │ [ Home ]                                         │  PageBanner
 *   │ [ search........................ ] [ Filters ]   │  DiscoverToolbar
 *   │ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐             │
 *   │ │card││card││card││card││card││card│  ...x18      │  card grid
 *   │ └────┘└────┘└────┘└────┘└────┘└────┘             │
 *   ├──────────────────────────────────────────────────┤
 *   │              (dark footer band)                  │  DiscoverFooter
 *   └──────────────────────────────────────────────────┘
 *
 * Clicking a card opens <ProfileModal> over a blurred backdrop — see that
 * component's confidence note for how that maps to the Figma.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import AppNav from "../components/AppNav";
import PageBanner from "../components/discover/PageBanner";
import DiscoverToolbar from "../components/discover/DiscoverToolbar";
import ProfileCard from "../components/discover/ProfileCard";
import ProfileModal from "../components/discover/ProfileModal";
import DiscoverFooter from "../components/discover/DiscoverFooter";

import { getDiscoverProfiles, getDiscoverProfile, likeProfile, passProfile } from "../services/postdateApi";

const DEFAULT_FILTERS = { gender: "Any", minAge: 18, maxAge: 60 };

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedProfile = params.get("profile");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let cancelled = false;
    setProfileError("");
    if (!requestedProfile) { setProfileLoading(false); setSelected(null); return; }
    setSelected(null); setProfileLoading(true);
    getDiscoverProfile(requestedProfile).then(profile => { if (!cancelled) setSelected(profile); })
      .catch(() => { if (!cancelled) setProfileError("This profile is no longer available. It may have been hidden, or you’ve already passed on it."); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [requestedProfile]);
  function closeProfile() {
    setSelected(null);
    if (requestedProfile) setParams(previous => { const next = new URLSearchParams(previous); next.delete("profile"); return next; }, { replace: true });
  }

  /* 🔌 BACKEND: GET /api/discover — see services/postdateApi.js.
     Re-fetches whenever the search text or filters change. Once the real
     route is live, send `query` and `filters` straight through as params
     (already wired below) so the server does the filtering. */
  useEffect(() => {
    generation.current += 1;
    let cancelled = false;
    setLoading(true);
    setError("");
    setProfiles([]);
    setNextCursor(null);

    const timer = setTimeout(() => getDiscoverProfiles({ query, ...filters })
      .then((data) => {
        if (!cancelled) { setProfiles(data.profiles); setNextCursor(data.nextCursor); }
      })
      .catch(() => !cancelled && setError("Could not load profiles. Please try again."))
      .finally(() => !cancelled && setLoading(false)), 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, filters, retry]);

  const visible = profiles;
  async function loadMore() {
    if (loading || !nextCursor) return;
    setLoading(true);
    setError("");
    const activeGeneration = generation.current;
    try {
      const data = await getDiscoverProfiles({ query, ...filters, cursor: nextCursor });
      if (activeGeneration !== generation.current) return;
      setProfiles((items) => [...items, ...data.profiles]);
      setNextCursor(data.nextCursor);
    } catch { if (activeGeneration === generation.current) setError("Could not load more profiles. Please try again."); }
    finally { if (activeGeneration === generation.current) setLoading(false); }
  }
  async function handleLike(profile) {
    const result = await likeProfile(profile.id);
    setProfiles((items) => items.filter((item) => item.id !== profile.id));
    setNotice(result.matched ? "It's a match! Open match history to see it." : "Like saved.");
    closeProfile();
    if (result.matched && result.matchId) navigate(`/messages?match=${encodeURIComponent(result.matchId)}`);
  }
  async function handlePass(profile) {
    await passProfile(profile.id);
    setProfiles((items) => items.filter((item) => item.id !== profile.id));
    closeProfile();
  }

  return (
    <div className="discover">
      <style>{`
        .discover {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--pd-pink);
        }

        .discover-main {
          flex: 1;
          width: 100%;
          max-width: var(--pd-max);
          margin: 0 auto;
          padding: clamp(14px, 2vw, 30px) var(--pd-gutter) clamp(28px, 4vw, 56px);

          display: flex;
          flex-direction: column;
          gap: clamp(16px, 2.2vw, 30px);
        }

        .discover-grid {
          display: grid;
          /* 🎛️ card size — raise the floor for bigger cards, fewer columns.
             The min(46%, 220px) keeps two columns on a phone instead of
             collapsing to one full-width card per row. */
          grid-template-columns: repeat(auto-fill, minmax(min(46%, 220px), 1fr));
          gap: clamp(10px, 1.4vw, 22px);
        }

        .discover-status {
          font-family: var(--pd-mono);
          font-size: clamp(12px, 1.1vw, 16px);
          color: var(--pd-maroon);
          padding: clamp(20px, 4vw, 50px) 0;
          text-align: center;
        }
      `}</style>

      <AppNav />

      <main className="discover-main">
        <PageBanner>Find your next connection.</PageBanner>
        <p className="member-page-description">Explore profiles, share a like, and start chatting when you both match.</p>

        <DiscoverToolbar
          query={query}
          onQuery={setQuery}
          filters={filters}
          onFilters={setFilters}
        />

        {error && <div className="discover-status" role="alert">{error} <button type="button" className="outline-button" onClick={() => nextCursor ? loadMore() : setRetry(v => v + 1)}>Try again</button></div>}
        {notice && <p className="discover-status" role="status">{notice}</p>}
        {profileLoading && <p role="status">Opening profile…</p>}
        {profileError && <p role="alert">{profileError}</p>}
        {loading && <p className="discover-status">Finding profiles…</p>}

        {!loading && !error && visible.length === 0 && (
          <p className="discover-status">
            Nobody matches those filters yet. Try widening the age range.
          </p>
        )}

        {visible.length > 0 && (
          <div className="discover-grid">
            {visible.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onOpen={() => setSelected(profile)}
              />
            ))}
          </div>
        )}
        {nextCursor && <button type="button" onClick={loadMore} disabled={loading}>Load more profiles</button>}
      </main>

      <DiscoverFooter />

      {selected && (
        <ProfileModal
          profile={selected}
          onClose={closeProfile}
          onLike={handleLike}
          onPass={handlePass}
        />
      )}
    </div>
  );
}
