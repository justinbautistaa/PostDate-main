/**
 * UsersSection
 * Every account, searchable and filterable, with the moderation actions.
 *
 * What a row offers comes from the server (`row.can`), not from guessing the
 * role here — so the buttons always agree with what the API will actually
 * allow. The API re-checks every action anyway.
 *
 *   Suspend / Reinstate   moderators and admins (never on yourself; moderators
 *                         can't touch staff)
 *   Role dropdown          admins only
 */
import { useEffect, useState } from "react";
import useAdminQuery from "./useAdminQuery";
import { getAdminUsers, reinstateUser, setUserRole, suspendUser } from "../../services/adminApi";
import { ActionDialog, Avatar, Badge, EmptyState, Pager, QueryError, SearchBox, SectionHead, Segmented, Sheet, useToast } from "./adminUi";
import { formatDate, roleLabel, timeAgo } from "./format";

const STATUS_TABS = [
  { value: "all", label: "Everyone" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "unverified", label: "Unverified" },
];

const ROLE_OPTIONS = [
  { value: "user", label: "Member" },
  { value: "moderator", label: "Staff" },
  { value: "admin", label: "Admin" },
];

export default function UsersSection({ role, onChanged, managedRole, teamOnly = false }) {
  const notify = useToast();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data, loading, error, reload } = useAdminQuery(
    () => getAdminUsers({ q: query, status, role: managedRole || roleFilter, ...(teamOnly ? { team: "true" } : {}), page }),
    [query, status, roleFilter, page, managedRole, teamOnly],
    { refreshMs: 10000 }
  );

  const isAdmin = role === "admin";
  const done = (message) => {
    notify(message);
    reload();
    onChanged?.();
  };

  function askSuspend(user) {
    setDialog({
      title: `Suspend ${user.name}?`,
      body: "They lose access straight away and can't log in until someone reinstates them.",
      tone: "danger",
      confirmLabel: "Suspend member",
      input: { label: "Reason", placeholder: "Recorded in the activity log and shown to other staff", required: true },
      run: async (reason) => {
        await suspendUser(user.id, reason);
        done(`${user.name} was suspended`);
      },
    });
  }

  function askReinstate(user) {
    setDialog({
      title: `Reinstate ${user.name}?`,
      body: "They can log in again. Any appeal they have waiting is closed as approved.",
      confirmLabel: "Reinstate",
      run: async () => {
        await reinstateUser(user.id);
        done(`${user.name} was reinstated`);
      },
    });
  }

  function askRole(user, nextRole) {
    setDialog({
      title: `Make ${user.name} ${roleLabel(nextRole).toLowerCase() === "admin" ? "an admin" : `a ${roleLabel(nextRole).toLowerCase()}`}?`,
      body:
        nextRole === "user"
          ? "They lose access to the staff dashboard."
          : nextRole === "admin"
          ? "Admins can do everything, including changing other people's roles."
          : "Moderators can handle reports, ratings and appeals, but can't act on other staff.",
      confirmLabel: "Change role",
      run: async () => {
        await setUserRole(user.id, nextRole);
        done(`${user.name} is now ${roleLabel(nextRole).toLowerCase() === "admin" ? "an admin" : `a ${roleLabel(nextRole).toLowerCase()}`}`);
      },
    });
  }

  const filtered = Boolean(query || roleFilter || status !== "all");
  function clearFilters() {
    setText("");
    setQuery("");
    setStatus("all");
    setRoleFilter("");
    setPage(1);
  }

  return (
    <>
      <SectionHead
        title={teamOnly ? "Staff management" : "Users"}
        sub={teamOnly ? "Manage administrator and staff accounts. Only administrators can change roles." : isAdmin ? "Manage member accounts. Search by name or email, or promote a member to staff." : "Manage member accounts, review their status, and suspend or restore access. Emails are partly hidden."}
      />

      <Sheet>
        <p className="ad-muted-note">Updates every 10 seconds while this tab is visible. Active means account access is enabled, not currently online. Last seen reflects recent server activity and can lag by about a minute.</p>
        <div className="ad-toolbar">
          <SearchBox value={text} onChange={setText} placeholder={isAdmin ? "Search name or email" : "Search by name"} label="Search users" />
          <Segmented
            label="Filter by status"
            options={STATUS_TABS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
          {isAdmin && !managedRole && <label className="ad-select">
            <span className="visually-hidden">Filter by role</span>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.filter(r => !teamOnly || r.value !== "user").map((r) => (
                <option key={r.value} value={r.value}>
                  {r.value === "moderator" ? "Staff" : `${r.label}s`}
                </option>
              ))}
            </select>
          </label>}
        </div>

        <QueryError error={error} onRetry={reload} />
        {!data && loading && <p className="ad-loading">Loading members…</p>}

        {data && (
          <div className={loading ? "ad-busy" : undefined}>
            {data.rows.length === 0 ? (
              <EmptyState title={filtered ? "No matching accounts" : teamOnly ? "No staff accounts yet" : "No members yet"}>
                {filtered ? (
                  <button type="button" className="ad-btn ad-btn-ghost" onClick={clearFilters}>
                    Clear the search and filters
                  </button>
                ) : (
                  teamOnly ? "Promote an existing member from Users to add them to your team." : "New member accounts will appear here after signup. Use Staff management to view your team."
                )}
              </EmptyState>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Role</th>
                      <th scope="col">Account status</th>
                      <th scope="col">Joined</th>
                      <th scope="col">Last seen</th>
                      <th scope="col" className="ad-num">
                        Rating
                      </th>
                      <th scope="col" className="ad-num">
                        Reports
                      </th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((u) => (
                      <tr key={u.id} className={u.status === "suspended" ? "ad-row-muted" : undefined}>
                        <td>
                          <div className="ad-person">
                            <Avatar name={u.name} src={u.avatar} />
                            <div>
                              <p className="ad-person-name">
                                {u.name}
                                {u.isDemo && <Badge tone="muted">Demo account</Badge>}
                                {u.isSelf && <span className="ad-you"> (you)</span>}
                              </p>
                              <p className="ad-person-sub">{u.email}</p>
                              {u.suspension && (
                                <p className="ad-person-why">
                                  Suspended {formatDate(u.suspension.at)}
                                  {u.suspension.reason ? `: ${u.suspension.reason}` : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge tone={u.role === "user" ? "muted" : "staff"}>{roleLabel(u.role)}</Badge>
                        </td>
                        <td>
                          <div className="ad-stack-tight">
                            <Badge tone={u.status === "suspended" ? "danger" : "ok"}>{u.status === "suspended" ? "Suspended" : "Active"}</Badge>
                            {!u.verified && <Badge tone="muted">Unverified</Badge>}
                          </div>
                        </td>
                        <td className="ad-nowrap">{formatDate(u.joinedAt)}</td>
                        <td className="ad-nowrap">{timeAgo(u.lastActiveAt)}</td>
                        <td className="ad-num">{u.rating.average === null ? "—" : `${u.rating.average.toFixed(1)} (${u.rating.count})`}</td>
                        <td className="ad-num">
                          {u.reports.total === 0 ? (
                            "0"
                          ) : (
                            <>
                              {u.reports.total}
                              {u.reports.open > 0 && <span className="ad-open-count"> ({u.reports.open} open)</span>}
                            </>
                          )}
                        </td>
                        <td>
                          <div className="ad-actions">
                            {u.can.suspend &&
                              (u.status === "suspended" ? (
                                <button type="button" className="ad-btn ad-btn-ok" onClick={() => askReinstate(u)}>
                                  Reinstate
                                </button>
                              ) : (
                                <button type="button" className="ad-btn ad-btn-danger-ghost" onClick={() => askSuspend(u)}>
                                  Suspend
                                </button>
                              ))}
                            {u.can.changeRole && (
                              <label className="ad-select ad-select-small">
                                <span className="visually-hidden">Role for {u.name}</span>
                                <select value={u.role} onChange={(e) => askRole(u, e.target.value)}>
                                  {ROLE_OPTIONS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {!u.can.suspend && !u.can.changeRole && <span className="ad-muted-note">{u.isSelf ? "This is your account" : u.can.note || "No actions"}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pager page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} noun="accounts" />
          </div>
        )}
      </Sheet>

      <ActionDialog config={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
