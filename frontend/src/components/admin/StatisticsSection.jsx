/**
 * StatisticsSection
 * The landing view of the dashboard: six "stamps" for the headline numbers,
 * one big chart of signups and matches, then reports, ratings and audience.
 *
 * Data: GET /api/admin/statistics?days= — one request. Changing the range
 * re-fetches; the old numbers stay on screen (dimmed) until the new ones land.
 */
import { useState } from "react";
import useAdminQuery from "./useAdminQuery";
import { getAdminStatistics } from "../../services/adminApi";
import { AreaChart, BarList, COLORS, Columns, Donut, Sparkline } from "./charts";
import { EmptyState, QueryError, SectionHead, Segmented, Sheet } from "./adminUi";
import { formatNumber, trendText } from "./format";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

// One colour per report status, matching the badges used on the Reports page.
const STATUS = [
  { key: "pending", label: "Pending", color: COLORS.salmon },
  { key: "reviewed", label: "Reviewed", color: COLORS.ink },
  { key: "resolved", label: "Resolved", color: COLORS.green },
  { key: "dismissed", label: "Dismissed", color: COLORS.grey },
];

const RATING_CATEGORIES = [
  { key: "overall", label: "Overall" },
  { key: "spice", label: "Spice" },
  { key: "attentiveness", label: "Attentive" },
  { key: "respectfulness", label: "Respectful" },
  { key: "chemistry", label: "Chemistry" },
];

const GENDER_COLORS = [COLORS.maroon, COLORS.salmon, COLORS.ink, COLORS.green, COLORS.grey];

/**
 * A postage stamp: perforated cream paper, a dashed inner frame holding the
 * numeral, and a maroon band with the label — the same construction as the
 * landing page's StepStamp. The label comes first in the markup (so screen
 * readers hear "Members, 1,284") and CSS flips it to the bottom.
 */
function Stamp({ label, value, note, tone = "plain", children }) {
  return (
    <div className={`ad-stamp ad-stamp-${tone}`}>
      <span className="ad-stamp-perf ad-stamp-perf-t" aria-hidden="true" />
      <span className="ad-stamp-perf ad-stamp-perf-b" aria-hidden="true" />
      <span className="ad-stamp-perf ad-stamp-perf-l" aria-hidden="true" />
      <span className="ad-stamp-perf ad-stamp-perf-r" aria-hidden="true" />
      <p className="ad-stamp-band">{label}</p>
      <div className="ad-stamp-inner">
        <p className="ad-stamp-value">{value}</p>
        {children}
        <p className="ad-stamp-note">{note}</p>
      </div>
    </div>
  );
}

export default function StatisticsSection() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAdminQuery(() => getAdminStatistics(days), [days]);

  const t = data?.totals;
  const members = data && trendText(data.trends.members.current, data.trends.members.previous);
  const matches = data && trendText(data.trends.matches.current, data.trends.matches.previous);
  const reportTotal = data ? STATUS.reduce((sum, s) => sum + data.reports.byStatus[s.key], 0) : 0;

  return (
    <>
      <SectionHead title="Statistics" sub="How POSTDATE! is doing right now.">
        <Segmented label="Time range" options={RANGES} value={days} onChange={setDays} />
      </SectionHead>

      <QueryError error={error} onRetry={reload} />
      {!data && loading && <p className="ad-loading">Loading the numbers…</p>}

      {data && (
        <div className={`ad-stack${loading ? " ad-busy" : ""}`}>
          <div className="ad-stamps">
            <Stamp label="Members" value={formatNumber(t.members)} note={members.text}>
              <Sparkline values={data.series.signups.map((d) => d.count)} />
            </Stamp>
            <Stamp label="Active now" value={formatNumber(t.activeNow)} note="in the last 5 minutes" />
            <Stamp label="Matches" value={formatNumber(t.matches)} note={matches.text}>
              <Sparkline values={data.series.matches.map((d) => d.count)} color={COLORS.ink} />
            </Stamp>
            <Stamp
              label="Open reports"
              value={formatNumber(t.pendingReports)}
              note={t.pendingReports ? "waiting for a decision" : "nothing waiting"}
              tone={t.pendingReports ? "attention" : "plain"}
            />
            <Stamp
              label="Appeals waiting"
              value={formatNumber(t.pendingAppeals)}
              note={t.pendingAppeals ? "from suspended members" : "nothing waiting"}
              tone={t.pendingAppeals ? "attention" : "plain"}
            />
            <Stamp label="Suspended" value={formatNumber(t.suspended)} note={`${formatNumber(t.unverified)} not yet verified`} />
          </div>

          <Sheet title="New members and matches" sub={`Day by day for the last ${data.range} days. Hover a day for the numbers.`}>
            <AreaChart
              key={data.range}
              labels={data.series.signups.map((d) => d.date)}
              series={[
                { name: "New members", color: COLORS.maroon, values: data.series.signups.map((d) => d.count) },
                { name: "Matches", color: COLORS.ink, dashed: true, values: data.series.matches.map((d) => d.count) },
              ]}
            />
          </Sheet>

          <div className="ad-grid-2">
            <Sheet title="Reports" sub="Every report ever filed, by where it stands.">
              {reportTotal === 0 ? (
                <EmptyState title="No reports yet">Reports filed by members show up here.</EmptyState>
              ) : (
                <>
                  <Donut
                    centerLabel="reports"
                    slices={STATUS.map((s) => ({ label: s.label, color: s.color, value: data.reports.byStatus[s.key] }))}
                  />
                  <h3 className="ad-minor">Most common reasons</h3>
                  <BarList items={data.reports.byReason.map((r) => ({ label: r.reason, value: r.count }))} />
                </>
              )}
            </Sheet>

            <Sheet title="Ratings" sub={`${formatNumber(data.ratings.count)} visible ratings. Hidden ones are left out.`}>
              {data.ratings.count === 0 ? (
                <EmptyState title="No ratings yet">Members rate each other after a date.</EmptyState>
              ) : (
                <>
                  <h3 className="ad-minor">Average score, out of 5</h3>
                  <BarList
                    max={5}
                    format={(v) => (v === null ? "n/a" : v.toFixed(1))}
                    items={RATING_CATEGORIES.map((c) => ({ label: c.label, value: data.ratings.averages[c.key] ?? 0 }))}
                  />
                  <h3 className="ad-minor">How the overall scores are spread</h3>
                  <Columns
                    items={data.ratings.distribution.map((d) => ({ label: `${d.star}`, value: d.count }))}
                    caption="Overall score, 1 to 5"
                  />
                </>
              )}
            </Sheet>
          </div>

          <Sheet title="Who is on POSTDATE!" sub="Members with a profile, by gender and by age.">
            <div className="ad-grid-2 ad-grid-flush">
              <div>
                <h3 className="ad-minor">Gender</h3>
                <Donut
                  centerLabel="profiles"
                  slices={data.audience.gender.map((g, i) => ({ label: g.label, value: g.count, color: GENDER_COLORS[i % GENDER_COLORS.length] }))}
                />
              </div>
              <div>
                <h3 className="ad-minor">Age</h3>
                <Columns items={data.audience.age.map((a) => ({ label: a.label, value: a.count }))} caption="Members per age band" />
              </div>
            </div>
          </Sheet>
        </div>
      )}
    </>
  );
}
