import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { isAuthenticated, getRole, clearToken } from "../auth";

/**
 * RequireAuth
 * Wraps a route element so it only renders for a logged-in user (and,
 * optionally, one specific role). See the RequireAuth sketch that used to
 * live at the bottom of App.jsx — this is that, filled in.
 *
 * Usage:
 *   <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
 *   <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard role="admin" /></RequireAuth>} />
 *
 * Not logged in            -> redirect to /login, remembering where they
 *                              were headed so Login.jsx could send them
 *                              back (see the `from` state below).
 * Logged in, wrong role     -> redirect home rather than show a 403 page.
 * Logged in, role matches
 * or no role was required   -> render the page.
 */
export default function RequireAuth({ role, children }) {
  const location = useLocation();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const expire = () => { clearToken(); setExpired(true); };
    window.addEventListener("postdate:session-expired", expire);
    return () => window.removeEventListener("postdate:session-expired", expire);
  }, []);

  if (expired || !isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (role && getRole() !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
