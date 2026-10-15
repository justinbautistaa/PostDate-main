/**
 * RatingsSection
 * Reviews members have left each other. The top of the page is a quick read on
 * overall quality (category averages and a score histogram, both over visible
 * ratings only); below it is the list staff actually moderate.
 *
 * Hiding a rating needs a reason and is reversible: it keeps the row, drops it
 * from every average, and is written to the activity log.
 */
import { useEffect, useState } from "react";
import useAdminQuery from "./useAdminQuery";
import { getAdminRatings, setRatingHidden } from "../../services/adminApi";
import { errorMessage } from "../../services/adminApi";
import { BarList, Columns } from "./charts";
import { ActionDialog, Badge, EmptyState, Pager, QueryError, SearchBox, SectionHead, Segmented, Sheet, useToast } from "./adminUi";
import { formatDate, timeAgo } from "./format";

const CATEGORIES = [
  { key: "overall", label: "Overall" },
  { key: "spice", label: "Spice" },
  { key: "attentiveness", label: "Attentive" },
  { key: "respectfulness", label: "Respectful" },
  { key: "chemistry", label: "Chemistry" },
];

const TABS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "low", label: "Low scores" },
];

/** Five squares, filled up to the score. The number sits beside it, so it never relies on fill alone. */
function Scale({ value }) {
  return (
    <span className="ad-scale" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= value ? "on" : undefined} />
      ))}
    </span>
  );
}

export default function RatingsSection({ onChanged }) {
  const notify = useToast();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data, loading, error, reload } = useAdminQuery(
    () => getAdminRatings({ q: query, visibility, page }),
    [query, visibility, page]
  );

  const done = (message) => {
    notify(message);
    reload();
    onChanged?.();
  };

  function askHide(r) {
    setDialog({
      title: "Hide this rating?",
      body: `It stays on record but stops counting toward ${r.reviewed?.name ?? "their"}'s average and won't be shown publicly. You can restore it any time.`,
      tone: "danger",
      confirmLabel: "Hide rating",
      input: { label: "Why is it being hidden?", placeholder: "For example: personal insults, not a review of the date", required: true },
      run: async (reason) => {
        await setRatingHidden(r.id, { hidden: true, reason });
        done("Rating hidden");
      },
    });
  }

  async function restore(r) {
    try {
      await setRatingHidden(r.id, { hidden: false });
      done("Rating restored");
    } catch (err) {
      notify(errorMessage(err, "Could not restore that rating."), "error");
    }
  }

  const s = data?.summary;

  return (
    <>
      <SectionHead title="Ratings" sub="What members say about their dates. Hide anything that breaks the rules." />

      {s && s.count > 0 && (
        <div className="ad-grid-2">
          <Sheet title="Average by category" sub={`Across ${s.count} visible ratings, out of 5.`}>
            <BarList
              max={5}
              format={(v) => v.toFixed(1)}
              items={CATEGORIES.map((c) => ({ label: c.label, value: s.averages[c.key] ?? 0 }))}
            />
          </Sheet>
          <Sheet title="How overall scores are spread">
            <Columns items={s.distribution.map((d) => ({ label: `${d.star}`, value: d.count }))} caption="Overall score, 1 to 5" />
          </Sheet>
        </div>
      )}

      <Sheet>
        <div className="ad-toolbar">
          <SearchBox value={text} onChange={setText} placeholder="Search names or comments" label="Search ratings" />
          <Segmented
            label="Filter ratings"
            options={TABS.map((t) => ({ ...t, count: data?.counts?.[t.value] }))}
            value={visibility}
            onChange={(v) => {
              setVisibility(v);
              setPage(1);
            }}
          />
        </div>

        <QueryError error={error} onRetry={reload} />
        {!data && loading && <p className="ad-loading">Loading ratings…</p>}

        {data && (
          <div className={loading ? "ad-busy" : undefined}>
            {data.rows.length === 0 ? (
              <EmptyState title="No ratings match">{query || visibility !== "all" ? "Try another tab or a different search." : "Ratings appear after members have been on a date."}</EmptyState>
            ) : (
              <ul className="ad-list">
                {data.rows.map((r) => (
                  <li key={r.id} className={`ad-item${r.isHidden ? " ad-item-hidden" : ""}`}>
                    <div className="ad-item-top">
                      <p className="ad-item-line ad-item-line-flush">
                        <strong>{r.reviewer?.name}</strong> rated <strong>{r.reviewed?.name}</strong>
                        {r.isHidden && <Badge tone="danger">Hidden</Badge>}
                        {!r.isHidden && r.scores.overall <= 2 && <Badge tone="pending">Low score</Badge>}
                      </p>
                      <time className="ad-item-time" dateTime={r.createdAt} title={formatDate(r.createdAt)}>
                        {timeAgo(r.createdAt)}
                      </time>
                    </div>

                    <dl className="ad-scores">
                      {CATEGORIES.map((c) => (
                        <div key={c.key} className={c.key === "overall" ? "ad-score ad-score-main" : "ad-score"}>
                          <dt>{c.label}</dt>
                          <dd>
                            <Scale value={r.scores[c.key]} />
                            <b>{r.scores[c.key]}</b>
                          </dd>
                        </div>
                      ))}
                    </dl>

                    {r.comment && <blockquote className="ad-quote">{r.comment}</blockquote>}

                    {r.isHidden && (
                      <p className="ad-item-handled">
                        Hidden{r.hiddenBy ? ` by ${r.hiddenBy.name}` : ""}
                        {r.hiddenAt ? ` on ${formatDate(r.hiddenAt)}` : ""}
                        {r.hiddenReason ? `. “${r.hiddenReason}”` : "."}
                      </p>
                    )}

                    <div className="ad-actions">
                      {r.isHidden ? (
                        <button type="button" className="ad-btn ad-btn-ghost" onClick={() => restore(r)}>
                          Restore
                        </button>
                      ) : (
                        <button type="button" className="ad-btn ad-btn-danger-ghost" onClick={() => askHide(r)}>
                          Hide rating
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Pager page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} noun="ratings" />
          </div>
        )}
      </Sheet>

      <ActionDialog config={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
