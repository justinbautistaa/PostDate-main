/**
 * ActivitySection  ("Mod activity" — admins only)
 * The audit trail: everything staff have done from the dashboard. Charts on top
 * show how busy the team has been and who's carrying the load; the feed below
 * is the full record, filterable by kind of action.
 *
 * The API refuses moderators (403), so a moderator who somehow lands here sees
 * the server's message rather than data.
 */
import { useState } from "react";
import useAdminQuery from "./useAdminQuery";
import { getAdminActivity } from "../../services/adminApi";
import { AreaChart, BarList, COLORS } from "./charts";
import { Badge, EmptyState, Pager, QueryError, SectionHead, Sheet } from "./adminUi";
import { formatDate, roleLabel, timeAgo } from "./format";

const ACTION_LABELS = {
  "user.suspend": "Suspended a member",
  "user.reinstate": "Reinstated a member",
  "user.role_change": "Changed a role",
  "report.update": "Updated a report",
  "rating.hide": "Hid a rating",
  "rating.restore": "Restored a rating",
  "appeal.approve": "Approved an appeal",
  "appeal.deny": "Denied an appeal",
};

// Destructive actions get the danger tone so they stand out when scanning the feed.
const ACTION_TONE = {
  "user.suspend": "danger",
  "rating.hide": "danger",
  "appeal.deny": "danger",
  "user.reinstate": "ok",
  "rating.restore": "ok",
  "appeal.approve": "ok",
  "user.role_change": "staff",
  "report.update": "neutral",
};

export default function ActivitySection() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAdminQuery(() => getAdminActivity({ action, page }), [action, page]);
  const s = data?.summary;
  const busiest = s ? s.perDay.reduce((best, d) => (d.count > best.count ? d : best), s.perDay[0]) : null;
  const total = s ? s.perDay.reduce((sum, d) => sum + d.count, 0) : 0;

  return (
    <>
      <SectionHead title="Staff activity" sub="Everything staff have done from this dashboard. Entries can't be edited or deleted." />

      <QueryError error={error} onRetry={reload} />
      {!data && loading && <p className="ad-loading">Loading activity…</p>}

      {data && (
        <div className={`ad-stack${loading ? " ad-busy" : ""}`}>
          <div className="ad-grid-2 ad-grid-wide-left">
            <Sheet title="Actions per day" sub={`${total} in the last ${s.days} days${total ? `, busiest on ${formatDate(busiest.date + "T12:00:00Z")}` : ""}.`}>
              <AreaChart
                height={210}
                labels={s.perDay.map((d) => d.date)}
                series={[{ name: "Actions", color: COLORS.maroon, values: s.perDay.map((d) => d.count) }]}
              />
            </Sheet>

            <Sheet title="Who did the work" sub={`Last ${s.days} days.`}>
              {s.byActor.length === 0 ? (
                <EmptyState title="No activity yet" />
              ) : (
                <BarList items={s.byActor.map((a) => ({ label: a.actor?.name ?? "Unknown", value: a.count }))} />
              )}
            </Sheet>
          </div>

          <Sheet
            title="The record"
            actions={
              <label className="ad-select">
                <span className="visually-hidden">Filter by action</span>
                <select
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All actions</option>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            {data.rows.length === 0 ? (
              <EmptyState title="Nothing recorded">Actions appear here the moment staff take them.</EmptyState>
            ) : (
              <ol className="ad-feed">
                {data.rows.map((e) => (
                  <li key={e.id} className="ad-feed-item">
                    <time dateTime={e.at} title={formatDate(e.at)}>
                      {timeAgo(e.at)}
                    </time>
                    <div>
                      <p className="ad-feed-summary">{e.summary}</p>
                      <p className="ad-feed-meta">
                        <Badge tone={ACTION_TONE[e.action] ?? "neutral"}>{ACTION_LABELS[e.action] ?? e.action}</Badge>
                        <span>
                          by <strong>{e.actor?.name}</strong> ({roleLabel(e.actor?.role).toLowerCase()})
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <Pager page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} noun="entries" />
          </Sheet>
        </div>
      )}
    </>
  );
}
