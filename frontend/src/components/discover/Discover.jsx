/**
 * Discover — the logged-in "home" feed: search, filter, browse a grid of
 * profiles, click one to open the like/pass modal.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ POSTDATE!             HOME  MESSAGES  PROFILE    │  AppNav (Home active)
 *   ├──────────────────────────────────────────────────┤
 *   │ HOME            [ search........... ] [ Filters ]│  header row: PageBanner
 *   │                                                   │  + DiscoverToolbar
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
import { useEffect, useMemo, useState } from "react";

import AppNav from "../components/AppNav";
import PageBanner from "../components/discover/PageBanner";
import DiscoverToolbar from "../components/discover/DiscoverToolbar";
import ProfileCard from "../components/discover/ProfileCard";
import ProfileModal from "../components/discover/ProfileModal";
import DiscoverFooter from "../components/discover/DiscoverFooter";

import { getDiscoverProfiles, likeProfile, passProfile } from "../services/postdateApi";

const DEFAULT_FILTERS = { gender: "Any", maxDistance: 50, minAge: 18, maxAge: 60 };

export default function Discover() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selected, setSelected] = useState(null);

  /* 🔌 BACKEND: GET /api/discover — see services/postdateApi.js.
     Re-fetches whenever the search text or filters change. Once the real
     route is live, send `query` and `filters` straight through as params
     (already wired below) so the server does the filtering. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getDiscoverProfiles({ query, ...filters })
      .then((data) => !cancelled && setProfiles(data))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, filters]);

  /* The mock endpoint above always returns everyone, so filter client-side
     for now — delete this once getDiscoverProfiles() does it server-side. */
  const visible = useMemo(() => {
    return profiles.filter((p) => {
      const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
      const matchesGender = filters.gender === "Any" || p.gender === filters.gender;
      const matchesDistance = p.distanceMi <= filters.maxDistance;
      const matchesAge = p.age >= filters.minAge && p.age <= filters.maxAge;
      return matchesQuery && matchesGender && matchesDistance && matchesAge;
    });
  }, [profiles, query, filters]);

  async function handleLike(profile) {
    await likeProfile(profile.id);
    setSelected(null);
  }

  async function handlePass(profile) {
    await passProfile(profile.id);
    setSelected(null);
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

        .discover-header-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: clamp(12px, 2vw, 24px);
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
        <div className="discover-header-row">
          <PageBanner>Home</PageBanner>
          
          <DiscoverToolbar
            query={query}
            onQuery={setQuery}
            filters={filters}
            onFilters={setFilters}
          />
        </div>

        {loading && <p className="discover-status">Finding people near you…</p>}

        {!loading && visible.length === 0 && (
          <p className="discover-status">
            Nobody matches those filters yet. Try widening the distance or age range.
          </p>
        )}

        {!loading && visible.length > 0 && (
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
      </main>

      <DiscoverFooter />

      {selected && (
        <ProfileModal
          profile={selected}
          onClose={() => setSelected(null)}
          onLike={handleLike}
          onPass={handlePass}
        />
      )}
    </div>
  );
}
