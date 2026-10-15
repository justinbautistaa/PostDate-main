import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api";
export default function ReportUpdates({ onCount }) {
  const [notice, setNotice] = useState(null);
  const seen = useRef(new Set());
  const location = useLocation();
  useEffect(() => {
    let active = true, fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      try {
        const { data } = await api.get("/reports/updates");
        if (!active || !Array.isArray(data)) return;
        onCount?.(data.length);
        const fresh = data.find(row => !seen.current.has(`${row.id}:${row.updatedAt}`));
        if (fresh) setNotice(fresh);
        data.forEach(row => seen.current.add(`${row.id}:${row.updatedAt}`));
      } catch { /* Retry after reconnecting; no private report data is cached. */ }
      finally { fetching = false; }
    }
    load(); const timer = setInterval(load, 60000);
    window.addEventListener("postdate:report-update", load);
    window.addEventListener("focus", load);
    return () => { active = false; clearInterval(timer); window.removeEventListener("postdate:report-update", load); window.removeEventListener("focus", load); };
  }, [onCount]);
  return notice && location.pathname !== "/my-reports" ? <div className="message-notification-toast" role="status"><Link to="/my-reports" onClick={() => setNotice(null)}><b>Your report was {notice.status}.</b><span>View My reports ↗</span></Link><button type="button" aria-label="Dismiss report update" onClick={() => setNotice(null)}>×</button></div> : null;
}
