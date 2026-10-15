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
export default function useAdminQuery(fetcher, deps = []) {
  const navigate = useNavigate();
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));

    fetcher()
      .then((data) => !cancelled && setState({ data, loading: false, error: "" }))
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          clearToken();
          navigate("/login", { replace: true });
          return;
        }
        setState((s) => ({ ...s, loading: false, error: errorMessage(err, "Could not load this section.") }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload };
}
