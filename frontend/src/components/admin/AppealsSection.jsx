/**
 * AppealsSection
 * Suspended members asking to come back. Each appeal shows the context staff
 * need to decide fairly: why and when the member was suspended, by whom, and
 * what the member wrote.
 *
 *   Approve   reinstates the account in the same step
 *   Deny      needs a reason (kept on record), account stays suspended
 */
import { useState } from "react";
import useAdminQuery from "./useAdminQuery";
import { decideAppeal, getAdminAppeals } from "../../services/adminApi";
import { ActionDialog, Badge, EmptyState, Pager, QueryError, SectionHead, Segmented, Sheet, useToast } from "./adminUi";
import { formatDate, timeAgo } from "./format";

const TABS = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "all", label: "All" },
];

const STATUS_TONE = { pending: "pending", approved: "ok", denied: "danger" };
const STATUS_LABEL = { pending: "Waiting", approved: "Approved", denied: "Denied" };

export default function AppealsSection({ onChanged }) {
  const notify = useToast();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);

  const { data, loading, error, reload } = useAdminQuery(() => getAdminAppeals({ status, page }), [status, page]);

  const done = (message) => {
    notify(message);
    reload();
    onChanged?.();
  };

  function askApprove(a) {
    setDialog({
      title: `Approve ${a.user.name}'s appeal?`,
      body: "Their account is reinstated right away and they can log in again.",
      confirmLabel: "Approve and reinstate",
      input: { label: "Note for the record", placeholder: "What convinced you", required: false },
      run: async (note) => {
        await decideAppeal(a.id, { decision: "approve", note });
        done(`${a.user.name} was reinstated`);
      },
    });
  }

  function askDeny(a) {
    setDialog({
      title: `Deny ${a.user.name}'s appeal?`,
      body: "Their account stays suspended. Your reason is kept with the decision.",
      tone: "danger",
      confirmLabel: "Deny appeal",
      input: { label: "Reason", placeholder: "Why the suspension stands", required: true },
      run: async (note) => {
        await decideAppeal(a.id, { decision: "deny", note });
        done("Appeal denied");
      },
    });
  }

  return (
    <>
      <SectionHead title="Appeals" sub="Suspended members asking for another chance." />

      <Sheet>
        <div className="ad-toolbar">
          <Segmented
            label="Filter appeals"
            options={TABS.map((t) => ({ ...t, count: data?.counts?.[t.value] }))}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>

        <QueryError error={error} onRetry={reload} />
        {!data && loading && <p className="ad-loading">Loading appeals…</p>}

        {data && (
          <div className={loading ? "ad-busy" : undefined}>
            {data.rows.length === 0 ? (
              <EmptyState title={status === "pending" ? "No appeals waiting" : "No appeals here"}>
                {status === "pending" ? "When a suspended member appeals, it shows up here." : "Try another tab."}
              </EmptyState>
            ) : (
              <ul className="ad-list">
                {data.rows.map((a) => (
                  <li key={a.id} className={`ad-item ad-item-${a.status === "approved" ? "resolved" : a.status === "denied" ? "dismissed" : "pending"}`}>
                    <div className="ad-item-top">
                      <div className="ad-item-badges">
                        <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                        <span className="ad-item-kind">{a.user.name}</span>
                        <span className="ad-person-sub">{a.user.email}</span>
                      </div>
                      <time className="ad-item-time" dateTime={a.createdAt} title={formatDate(a.createdAt)}>
                        {timeAgo(a.createdAt)}
                      </time>
                    </div>

                    {a.user.suspension ? (
                      <p className="ad-item-context">
                        Suspended {formatDate(a.user.suspension.at)}
                        {a.user.suspension.by ? ` by ${a.user.suspension.by.name}` : ""}
                        {a.user.suspension.reason ? `. Reason on file: “${a.user.suspension.reason}”` : "."}
                      </p>
                    ) : (
                      a.status === "pending" && <p className="ad-item-context">This account is no longer suspended.</p>
                    )}

                    <blockquote className="ad-quote">{a.message}</blockquote>

                    {a.decidedBy && (
                      <p className="ad-item-handled">
                        {STATUS_LABEL[a.status]} by <strong>{a.decidedBy.name}</strong>
                        {a.decidedAt ? ` on ${formatDate(a.decidedAt)}` : ""}
                        {a.decisionNote ? `. “${a.decisionNote}”` : "."}
                      </p>
                    )}

                    {a.status === "pending" && (
                      <div className="ad-actions">
                        {a.can.decide ? (
                          <>
                            <button type="button" className="ad-btn ad-btn-ok" onClick={() => askApprove(a)}>
                              Approve and reinstate
                            </button>
                            <button type="button" className="ad-btn ad-btn-danger-ghost" onClick={() => askDeny(a)}>
                              Deny
                            </button>
                          </>
                        ) : (
                          <span className="ad-muted-note">Only an admin can decide appeals from staff accounts.</span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <Pager page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} noun="appeals" />
          </div>
        )}
      </Sheet>

      <ActionDialog config={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
