/**
 * MatchHistory
 * The clock icon in the logged-in header and the maroon dropdown it opens.
 * One cream card per match: you on the left, them on the right, the date you
 * matched, and a REVIEW button (or a dark REVIEWED tag once you've left one).
 * Matches Figma "Rectangle 388" (panel) + "Polygon 5" (the pointer).
 *
 * The list is an infinite scroll: it asks the backend for one page at a time
 * and loads the next when you get near the bottom. The ↑ button pinned to the
 * foot jumps back to the top. (The "infinate scroll" text in the Figma is a
 * designer's note, so it isn't drawn. The blank third card is used as the
 * loading placeholder.)
 *
 * Usage:
 *   <MatchHistory />                                        // lives in <AppNav />
 *   <MatchHistory onReview={(m) => navigate(`/review/${m.id}`)} />
 *
 * 🔌 BACKEND: getMatchHistory() in services/postdateApi.js — GET
 * /api/matches/history. It's fetched when the panel opens, not on page load.
 *
 * REVIEW opens the match review form. An optional onReview callback can
 * replace that form in another context.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getMatchHistory } from "../services/postdateApi";
import { Link } from "react-router-dom";
import ReviewForm from "./ReviewForm";
import ProfilePhoto from "./ProfilePhoto";

const PAGE_SIZE = 8; // 🎛️ matches fetched per request

const EMPTY_PAGE = { items: [], cursor: null, hasMore: true, loading: false, error: false };

/* "2026-09-27T…" → "09/27/26", the MM/DD/YY from the design */
function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
}

/* one salmon circle with a name underneath */
function Person({ person }) {
  const { name = "", avatarUrl } = person ?? {};
  return (
    <span className="mh-person">
      <span className="mh-avatar"><ProfilePhoto src={avatarUrl} name={name} /></span>
      <span className="mh-name" title={name}>
        {name}
      </span>
    </span>
  );
}

export default function MatchHistory({ onReview }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(EMPTY_PAGE);
  const [me, setMe] = useState(null);
  const [atTop, setAtTop] = useState(true);
  const [reviewMatch, setReviewMatch] = useState(null);
  const [reviewNotice, setReviewNotice] = useState("");

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const sentinelRef = useRef(null);
  const busy = useRef(false); // a request is in flight
  const session = useRef(0); // bumps on close, so a late reply is ignored

  const { items, cursor, hasMore, loading, error } = page;

  /* Fetch one page. `after` is null for the first page, which replaces the
     list; any other cursor appends. */
  const loadPage = useCallback(async (after) => {
    if (busy.current) return;
    busy.current = true;
    const mine = session.current;
    setPage((p) => ({ ...p, loading: true, error: false }));

    try {
      /* 🔌 BACKEND: GET /api/matches/history — see services/postdateApi.js */
      const res = await getMatchHistory({ cursor: after, limit: PAGE_SIZE });
      if (mine !== session.current) return;
      setMe(res.me ?? null);
      setPage((p) => ({
        items: after ? [...p.items, ...res.matches] : res.matches,
        cursor: res.nextCursor ?? null,
        hasMore: Boolean(res.nextCursor),
        loading: false,
        error: false,
      }));
    } catch {
      if (mine === session.current) setPage((p) => ({ ...p, loading: false, error: true }));
    } finally {
      if (mine === session.current) busy.current = false;
    }
  }, []);

  /* Closing throws the list away, so the next open starts fresh and a match
     made in the meantime shows up. */
  useEffect(() => {
    if (open) return;
    session.current += 1;
    busy.current = false;
    setPage(EMPTY_PAGE);
    setAtTop(true);
  }, [open]);

  /* The sentinel at the end of the list does double duty: when the panel
     opens it's already in view, which loads page one; after that it loads the
     next page whenever you scroll close to it. */
  useEffect(() => {
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!open || !root || !target || !hasMore || loading || error) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadPage(cursor);
      },
      { root, rootMargin: "0px 0px 160px 0px" } // 🎛️ start loading this far before the end
    );
    io.observe(target);
    return () => io.disconnect();
  }, [open, hasMore, loading, error, cursor, loadPage]);

  /* click outside or Esc closes */
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function scrollToTop() {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  }

  function handleReview(match) {
    if (onReview) onReview(match);
    else setReviewMatch(match);
    setOpen(false);
  }

  return (
    <div className="mh" ref={rootRef}>
      {reviewNotice && <span className="review-notice" role="status">{reviewNotice}<button onClick={() => setReviewNotice("")} aria-label="Dismiss review confirmation">×</button></span>}
      {reviewMatch && <ReviewForm match={reviewMatch} onClose={() => setReviewMatch(null)} onSaved={() => { setReviewMatch(null); setReviewNotice("Your review was saved. Thank you for your feedback."); setPage(EMPTY_PAGE); }} />}
      <style>{`
        .mh {
          /* 🎛️ ONE FIGMA PIXEL for this widget. Every size below is
             calc(<Figma px> * var(--mh-u)), so changing this one number
             resizes the whole dropdown. 1px = exact Figma size (a 1920px
             window); the clamp shrinks it on smaller screens. */
          --mh-u: clamp(0.72px, 0.052vw, 1px);

          position: relative;
          flex: none;
        }

        /* ── the clock button (Figma "image 15", 60 x 60) ──────────────── */
        .mh-trigger {
          display: grid;
          place-items: center;
          width: clamp(34px, 3.1vw, 60px);    /* 🎛️ icon size */
          height: clamp(34px, 3.1vw, 60px);
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--pd-ink);
          transition: transform 0.15s ease;
        }
        .mh-trigger:hover { transform: translateY(-2px); }
        .mh-trigger svg { width: 100%; height: 100%; }

        /* ── pointer + panel, centred under the icon ───────────────────── */
        .mh-pop {
          position: absolute;
          top: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;

          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* Figma "Polygon 5" — 85 x 76. Only the two slanted sides get the
           outline, so the flat base blends into the panel. */
        .mh-caret {
          position: relative;
          z-index: 1;
          display: block;
          width: calc(85 * var(--mh-u));
          height: calc(76 * var(--mh-u));
          margin-bottom: -1px;
          overflow: visible;
        }

        /* Figma "Rectangle 388" — 441 x 818, radius 10 */
        .mh-panel {
          display: flex;
          flex-direction: column;
          width: calc(441 * var(--mh-u));
          max-height: min(calc(818 * var(--mh-u)), 78vh);   /* 🎛️ tallest the panel gets */
          overflow: hidden;

          background: var(--pd-maroon);
          border: 1px solid var(--pd-ink);
          border-radius: var(--pd-radius);
          box-shadow: 0 18px 34px -18px rgba(43, 35, 32, 0.5);
        }

        .mh-list {
          flex: 1 1 auto;
          min-height: 0;
          margin: 0;
          padding: calc(6 * var(--mh-u)) calc(5.5 * var(--mh-u));
          list-style: none;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: var(--pd-pink) transparent;

          display: flex;
          flex-direction: column;
          gap: calc(8 * var(--mh-u));   /* 🎛️ space between cards */
        }

        /* ── one match: Figma "Rectangle 389", 430 x 150 ───────────────── */
        .mh-card {
          flex: none;   /* a flex column would otherwise squash the cards */
          display: grid;
          grid-template-columns: calc(100 * var(--mh-u)) minmax(0, 1fr) calc(100 * var(--mh-u));
          align-items: center;
          column-gap: calc(4 * var(--mh-u));
          height: calc(150 * var(--mh-u));
          padding: 0 calc(6 * var(--mh-u));

          background: var(--pd-cream);
          border-radius: var(--pd-radius);
          color: var(--pd-maroon);
          font-family: var(--pd-mono);
        }

        /* Figma "Ellipse 143" (100 x 100) + "NAME" (Space Mono 20) */
        .mh-person {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 0;
        }
        .mh-avatar {
          width: calc(100 * var(--mh-u));
          height: calc(100 * var(--mh-u));
          border-radius: 50%;
          background: var(--pd-salmon);
          overflow: hidden;
        }
        .mh-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .mh-name {
          max-width: 100%;
          font-size: calc(20 * var(--mh-u));
          line-height: calc(30 * var(--mh-u));
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mh-mid {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 0;
        }

        /* Figma "MATCH!" — Fraunces 400, 40 / 49 */
        .mh-title {
          margin: 0;
          font-family: var(--pd-display);
          font-weight: 400;
          font-size: calc(40 * var(--mh-u));   /* 🎛️ "match!" size */
          line-height: calc(49 * var(--mh-u));
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* Figma "MM/DD/YY" — Space Mono 20 / 30 */
        .mh-date {
          font-size: calc(20 * var(--mh-u));
          line-height: calc(30 * var(--mh-u));
        }

        /* Figma "Rectangle 391" / "Rectangle 393" — 160 x 40, 2px maroon
           border, radius 5, Fraunces 24 */
        .mh-review,
        .mh-reviewed {
          display: grid;
          place-items: center;
          width: calc(160 * var(--mh-u));
          height: calc(40 * var(--mh-u));
          margin-top: calc(6 * var(--mh-u));
          padding: 0;

          border: calc(2 * var(--mh-u)) solid var(--pd-maroon);
          border-radius: calc(5 * var(--mh-u));
          font-family: var(--pd-display);
          font-weight: 400;
          font-size: calc(24 * var(--mh-u));
          line-height: 1;
          text-transform: uppercase;
          color: var(--pd-maroon);
        }
        .mh-review {
          background: var(--pd-pink);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .mh-review:hover { transform: translateY(-2px); }

        /* 🎛️ The design sets REVIEWED in maroon on near-black, which is only
           about 2.7:1 contrast. Change the colour below to var(--pd-pink) if
           you want it easier to read. */
        .mh-reviewed {
          background: var(--pd-ink);
          color: var(--pd-maroon);
        }

        /* the blank card in the Figma, reused as the loading placeholder */
        @media (prefers-reduced-motion: no-preference) {
          .mh-skel { animation: mh-pulse 1.2s ease-in-out infinite; }
          @keyframes mh-pulse { 50% { opacity: 0.6; } }
        }

        .mh-note {
          flex: none;
          padding: calc(16 * var(--mh-u)) calc(10 * var(--mh-u));
          font-family: var(--pd-mono);
          font-size: calc(18 * var(--mh-u));
          line-height: 1.5;
          text-align: center;
          color: var(--pd-cream);
        }
        .mh-retry {
          padding: 0;
          background: none;
          border: none;
          font: inherit;
          color: inherit;
          text-decoration: underline;
          cursor: pointer;
        }

        .mh-sentinel { flex: none; height: 1px; }

        /* ── foot: Figma "Ellipse 142" (50 x 50) with the ↑ arrow ──────── */
        .mh-foot {
          flex: none;
          display: flex;
          justify-content: center;
          padding: calc(8 * var(--mh-u)) 0 calc(12 * var(--mh-u));
        }
        .mh-top {
          display: grid;
          place-items: center;
          width: calc(50 * var(--mh-u));
          height: calc(50 * var(--mh-u));
          padding: 0;
          border: none;
          border-radius: 50%;
          background: var(--pd-cream);
          color: var(--pd-maroon);
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.2s ease;
        }
        .mh-top:hover { transform: translateY(-2px); }
        .mh-top[data-at-top="true"] { opacity: 0.55; }   /* nothing above to scroll to */
        .mh-top svg { width: 55%; height: 55%; }

        /* Phone: the header wraps, so a panel centred on the icon could run
           off the edge. Pin it to the header instead, edge to edge, and
           scale the cards to fit. AppNav sets position: relative on the
           header for this. */
        @media (max-width: 620px) {
          .mh {
            position: static;
            --mh-u: min(1px, calc((100vw - 2 * var(--pd-gutter)) / 441));
          }
          .mh-pop {
            top: 100%;
            left: var(--pd-gutter);
            right: var(--pd-gutter);
            margin-top: 6px;
            transform: none;
            align-items: stretch;
          }
          .mh-caret { display: none; }
          .mh-panel { width: 100%; }
        }
      `}</style>

      <button
        ref={triggerRef}
        type="button"
        className="mh-trigger"
        aria-label="Match history"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? "mh-panel" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {/* clock with a rewind arrow, drawn inline so there's no icon file */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>
      </button>

      {open && (
        <div className="mh-pop">
          <svg className="mh-caret" viewBox="0 0 85 76" aria-hidden="true">
            <polyline
              points="0.5,76 42.5,0.5 84.5,76"
              fill="var(--pd-maroon)"
              stroke="var(--pd-ink)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="mh-panel" id="mh-panel" role="dialog" aria-label="Match history">
            <header className="mh-heading"><div><h2>Match history</h2><p>Your connections, all in one place.</p></div><button type="button" aria-label="Close match history" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>×</button></header>
            <ul
              className="mh-list"
              ref={listRef}
              aria-busy={loading}
              onScroll={(e) => setAtTop(e.currentTarget.scrollTop < 8)}
            >
              {items.map((match) => {
                const { id, matchedAt, reviewed, partner } = match;
                return (
                  <li className="mh-card" key={id}>
                    <Person person={me ?? { name: "You" }} />

                    <div className="mh-mid">
                      <p className="mh-title">
                        Match!
                        <span className="visually-hidden"> with {partner?.name}</span>
                      </p>
                      <time className="mh-date" dateTime={matchedAt}>
                        {formatDate(matchedAt)}
                      </time>

                      {reviewed ? (
                        <span className="mh-reviewed">Reviewed</span>
                      ) : (
                        <button
                          type="button"
                          className="mh-review"
                          onClick={() => handleReview(match)}
                          aria-label={`Review your match with ${partner?.name ?? "this person"}`}
                        >
                          Review
                        </button>
                      )}
                    <Link className="mh-reviewed" to={`/messages?match=${encodeURIComponent(id)}`} onClick={() => setOpen(false)}>Chat ↗</Link>
                    </div>

                    <Person person={partner} />
                  </li>
                );
              })}

              {loading &&
                Array.from({ length: items.length ? 1 : 3 }, (_, i) => (
                  <li className="mh-card mh-skel" key={`skel-${i}`} aria-hidden="true" />
                ))}

              {!loading && !error && !hasMore && items.length === 0 && (
                <li className="mh-note" role="status">
                  No matches yet. Visit Find dates and like a few profiles. When you both like each other, your match appears here.
                </li>
              )}

              {error && (
                <li className="mh-note" role="alert">
                  Could not load your matches.{" "}
                  <button type="button" className="mh-retry" onClick={() => loadPage(cursor)}>
                    Try again
                  </button>
                </li>
              )}

              {hasMore && !error && <li className="mh-sentinel" ref={sentinelRef} aria-hidden="true" />}
            </ul>

            <div className="mh-foot">
              <button
                type="button"
                className="mh-top"
                data-at-top={atTop}
                onClick={scrollToTop}
                aria-label="Back to top"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
