/**
 * App — the route table for the whole frontend.
 *
 * 🎛️ ADD A PAGE
 *   1. create it in src/pages/
 *   2. import it here
 *   3. add a <Route path="/your-path" element={<YourPage />} />
 *
 * 🔒 AUTH: /discover and /profile need someone logged in; /admin needs the
 * "admin" role specifically and /moderator needs "moderator" — see
 * components/RequireAuth.jsx. This is routing convenience only: the backend
 * enforces the real check on every request via requireAuth/requireRole
 * (backend/middleware/auth.js) regardless of what this file does.
 */
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";

import Home from "./pages/Home";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import MyReports from "./pages/MyReports";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Appeal from "./pages/Appeal";
const Discover = lazy(() => import("./pages/Discover"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const Messages = lazy(() => import("./pages/Messages"));
import RequireAuth from "./components/RequireAuth";
import PageErrorBoundary from "./components/PageErrorBoundary";

import "./App.css";
import "./RoleUI.css";

function App() {
  const location = useLocation();
  return (
    <PageErrorBoundary key={location.pathname}>
    <Suspense fallback={<main role="status" style={{ padding: "48px 24px", textAlign: "center" }}>Loading PostDate…</main>}>
    <Routes>
      {/* ── public ────────────────────────────────────────────────────── */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/appeal" element={<Appeal />} />
      {/* log-in, plus the "forgot password" screens (recovery code → new password) */}
      <Route path="/login" element={<Login />} />

      {/* ── signed in ─────────────────────────────────────────────────── */}
      <Route path="/dashboard" element={<RequireAuth><UserDashboard /></RequireAuth>} />
      <Route path="/my-reports" element={<RequireAuth><MyReports /></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
      <Route path="/user" element={<Navigate to="/dashboard" replace />} />
      <Route path="/staff" element={<RequireAuth role="moderator"><AdminDashboard role="moderator" /></RequireAuth>} />
      <Route
        path="/discover"
        element={
          <RequireAuth>
            <Discover />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />

      {/* ── staff ─────────────────────────────────────────────────────────
          One page, two roles. "admin" shows all nine sidebar sections;
          "moderator" shows the shorter six-item list. Each route only opens
          for its own role — an admin visiting /moderator still gets bounced
          home, same as anyone else, rather than the two dashboards blurring
          into "any staff role can see either page". */}
      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <AdminDashboard role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/moderator"
        element={
          <RequireAuth role="moderator">
            <AdminDashboard role="moderator" />
          </RequireAuth>
        }
      />

      {/* Anything unrecognised goes home rather than showing a blank page. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </PageErrorBoundary>
  );
}

export default App;
