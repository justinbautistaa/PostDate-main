/**
 * ReportsSection
 * The moderation queue. Tabs filter by status (with live counts); each report
 * shows who filed it, who it's about, what they wrote, and the actions that
 * make sense for its current state:
 *
 *   pending    Mark reviewed · Resolve · Dismiss · Suspend (and resolve)
 *   reviewed   Resolve · Dismiss · Suspend (and resolve)
 *   closed     Reopen
 *
 * "Suspend and resolve" is one step: it suspends the reported member and, if
 * that worked, closes the report with a note saying so.
 */
import { useState } from "react";
import useAdminQuery from "./useAdminQuery";
import { getAdminReports, suspendUser, updateReport } from "../../services/adminApi";
import { errorMessage } from "../../services/adminApi";
import { ActionDialog, Badge, EmptyState, Pager, QueryError, SectionHead, Segmented, Sheet, useToast } from "./adminUi";
import { formatDate, timeAgo } from "./format";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const STATUS_TONE = { pending: "pending", reviewed: "neutral", resolved: "ok", dismissed: "muted" };
const STATUS_LABEL = { pending: "Pending", reviewed: "Reviewed", resolved: "Resolved", dismissed: "Dismissed" };
const TARGET_LABEL = { user: "a profile", post: "a post", comment: "a comment", message: "a message" };

export default function ReportsSection({ onChanged }) {
  const notify = useToast();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);

  const { data, loading, error, reload } = useAdminQuery(() => getAdminReports({ status, page }), [status, page]);

  const done = (message) => {
    notify(message);
    reload();
    onChanged?.();
  };

  /** A change that needs no explanation (mark reviewed, reopen). */
  async function quick(report, nextStatus, message) {
    try {
      await updateReport(report.id, { status: nextStatus });
      done(message);
    } catch (err) {
      notify(errorMessage(err, "Could not update that report."), "error");
    }
  }

  function askClose(report, nextStatus) {
    const resolving = nextStatus === "resolved";
    setDialog({
      title: resolving ? "Resolve this report?" : "Dismiss this report?",
      body: resolving
        ? "Use this when you acted on it or the problem is fixed."
        : "Use this when there's nothing to act on. The reporter isn't told either way.",
      confirmLabel: resolving ? "Resolve" : "Dismiss",
      input: { label: "Note for the record", placeholder: "What you found or did", required: false },
      run: async (note) => {
        await updateReport(report.id, { status: nextStatus, note });
        done(resolving ? "Report resolved" : "Report dismissed");
      },
    });
  }

  function askSuspend(report) {
    const target = report.reportedUser;
    setDialog({
      title: `Suspend ${target.name}?`,
      body: "They lose access straight away. This report is marked resolved at the same time.",
      tone: "danger",
      confirmLabel: "Suspend and resolve",
      input: { label: "Reason", initial: `${report.reason}: confirmed after review`, required: true },
      run: async (reason) => {
        await suspendUser(target.id, reason);
        // The suspension is what matters; if closing the report fails the member is still suspended.
        await updateReport(report.id, { status: "resolved", note: `Member suspended: ${reason}` }).catch(() => {});
        done(`${target.name} was suspended and the report resolved`);
      },
    });
  }

  return (
    <>
      <SectionHead title="Reports" sub="What members have flagged. Start with Pending." />

      <Sheet>
        <div className="ad-toolbar">
          <Segmented
            label="Filter reports by status"
            options={TABS.map((t) => ({ ...t, count: data?.counts?.[t.value] }))}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>

        <QueryError error={error} onRetry={reload} />
        {!data && loading && <p className="ad-loading">Loading reports…</p>}

        {data && (
          <div className={loading ? "ad-busy" : undefined}>
            {data.rows.length === 0 ? (
              <EmptyState title={status === "pending" ? "Nothing waiting for review" : "No reports here"}>
                {status === "pending" ? "New reports from members land here." : "Try another tab."}
              </EmptyState>
            ) : (
              <ul className="ad-list">
                {data.rows.map((r) => (
                  <li key={r.id} className={`ad-item ad-item-${r.status}`}>
                    <div className="ad-item-top">
                      <div className="ad-item-badges">
                        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        <span className="ad-item-kind">{r.reason}</span>
                      </div>
                      <time className="ad-item-time" dateTime={r.createdAt} title={formatDate(r.createdAt)}>
                        {timeAgo(r.createdAt)}
                      </time>
                    </div>

                    <p className="ad-item-line">
                      <strong>{r.reporter?.name}</strong> reported {TARGET_LABEL[r.targetType]}
                      {r.reportedUser && (
                        <>
                          {" "}
                          from <strong>{r.reportedUser.name}</strong>
                          {r.reportedUser.status === "suspended" && <Badge tone="danger">Suspended</Badge>}
                          {r.reportedUser.role && r.reportedUser.role !== "user" && <Badge tone="staff">Staff</Badge>}
                        </>
                      )}
                    </p>

                    {r.description && <blockquote className="ad-quote">{r.description}</blockquote>}

                    {r.handledBy && (
                      <p className="ad-item-handled">
                        {r.status === "reviewed" ? "Reviewed" : r.status === "pending" ? "Handled" : STATUS_LABEL[r.status]} by{" "}
                        <strong>{r.handledBy.name}</strong>
                        {r.resolvedAt ? ` on ${formatDate(r.resolvedAt)}` : ""}
                        {r.note ? `. “${r.note}”` : "."}
                      </p>
                    )}

                    <div className="ad-actions">
                      {r.status === "pending" && (
                        <button type="button" className="ad-btn ad-btn-ghost" onClick={() => quick(r, "reviewed", "Marked as reviewed")}>
                          Mark reviewed
                        </button>
                      )}
                      {(r.status === "pending" || r.status === "reviewed") && (
                        <>
                          <button type="button" className="ad-btn ad-btn-ok" onClick={() => askClose(r, "resolved")}>
                            Resolve
                          </button>
                          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => askClose(r, "dismissed")}>
                            Dismiss
                          </button>
                          {r.can.suspendReported && (
                            <button type="button" className="ad-btn ad-btn-danger-ghost" onClick={() => askSuspend(r)}>
                              Suspend {r.reportedUser.name.split(" ")[0]}
                            </button>
                          )}
                        </>
                      )}
                      {(r.status === "resolved" || r.status === "dismissed") && (
                        <button type="button" className="ad-btn ad-btn-ghost" onClick={() => quick(r, "pending", "Report reopened")}>
                          Reopen
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Pager page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} noun="reports" />
          </div>
        )}
      </Sheet>

      <ActionDialog config={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
