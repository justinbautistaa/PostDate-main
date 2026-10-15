import { useEffect, useState } from "react";
import api from "../../api";
export default function BlockedPeople() {
  const [rows, setRows] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  async function load() { try { setRows((await api.get("/chats/blocked")).data); setError(""); } catch { setError("Blocked people couldn’t load. Please try again."); } }
  useEffect(() => { load(); }, []);
  return <section><h3>Blocked people</h3><p>Unblocking removes your block. It does not restore the match or reopen the conversation.</p>{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}<button type="button" onClick={load}>Try again</button></p>}{rows?.length === 0 && <p>You haven’t blocked anyone.</p>}{rows && <ul className="blocked-people">{rows.map(row => <li key={row.id}><span>{row.name}</span><button type="button" className="outline-button" disabled={busy} onClick={async () => { setBusy(true); try { await api.post(`/chats/${row.id}/unblock`); setRows(previous => previous.filter(item => item.id !== row.id)); setNotice(`${row.name} was unblocked.`); } catch { setError("Could not unblock this person. Please try again."); } finally { setBusy(false); } }}>Unblock</button></li>)}</ul>}</section>;
}
