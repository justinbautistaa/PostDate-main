import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../../auth";
import { errorMessage } from "../../services/adminApi";

/**
 * useAdminQuery
 * Loads one dashboard section's data and keeps the PREVIOUS data on screen
 * while the next page / filter loads, so lists dim instead of flashing empty.
 *
 *   const { data, loading, error, reload } = useAdminQuery(
 *     () => getAdminUsers({ q, page }),
 *     [q, page]            // refetch whenever these change
 *   );
 *
 * A 401 means the session ended (expired token, or the account was suspended
 * or demoted while the page was open), so it clears the token and sends the
 * person to /login rather than leaving a dead dashboard on screen.
 */
export default function useAdminQuery(fetcher, deps = [], { refreshMs = 0 } = {}) {
  const navigate = useNavigate();
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    let fetching = false;
    function load(background = false) {
      if (cancelled || fetching) return;
      fetching = true;
      if (!background) setState((s) => ({ ...s, loading: true, error: "" }));
      Promise.resolve().then(fetcher)
      .then((data) => !cancelled && setState({ data, loading: false, error: "" }))
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          clearToken();
          navigate("/login", { replace: true });
          return;
        }
        setState((s) => ({ ...s, loading: false, error: errorMessage(err, "Could not load this section.") }));
      }).finally(() => { fetching = false; });
    }
    load();
    const refresh = () => { if (document.visibilityState !== "hidden") load(true); };
    const timer = refreshMs > 0 ? setInterval(refresh, refreshMs) : null;
    if (refreshMs > 0) {
      window.addEventListener("focus", refresh);
      document.addEventListener("visibilitychange", refresh);
    }

    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, refreshMs]);

  return { ...state, reload };
}
