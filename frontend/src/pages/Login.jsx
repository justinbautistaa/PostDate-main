/**
 * Login — the log-in page, with password recovery built in.
 *
 * One route (/login), three views that swap inside the same panel, exactly
 * like the three Figma frames:
 *
 *    view "login"              view "recovery"            view "password"
 *   ┌───────────────┐         ┌───────────────┐          ┌───────────────┐
 *   │    LOG-IN     │ forgot  │   RECOVERY    │ code ok  │   PASSWORD    │
 *   │ email + pass  │────────▶│  enter code   │─────────▶│ new + repeat  │
 *   │ Forgot pass?  │         │  00:00 timer  │          │   CONFIRM     │
 *   └───────────────┘         └───────────────┘          └───────┬───────┘
 *           ▲                                                    │
 *           └────────────────── password saved ──────────────────┘
 *
 * Clicking "Log in" in the header while you're already here starts over at
 * the first view, which is the way out of the recovery screens.
 *
 * This page owns the FLOW (which view, which email, when the code expires)
 * and makes the four backend calls. The forms in components/auth/ only check
 * their boxes and report back, the same way the sign-up steps do.
 *
 * Login and recovery use the authenticated server API and real email delivery.
 *
 * 🎛️ Like the sign-up page this is a fixed layout sized in Figma pixels
 *    (`calc(<Figma px> * var(--u))`); --u lives in src/theme.css.
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { setSession, isAuthenticated, getRole } from "../auth";
import VerificationModal from "../components/VerificationModal";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import AuthPanel from "../components/auth/AuthPanel";
import "./Login.css";
import "./PublicPages.css";
import LoginForm from "../components/auth/LoginForm";
import RecoveryForm from "../components/auth/RecoveryForm";
import NewPasswordForm from "../components/auth/NewPasswordForm";
import MfaForm from "../components/auth/MfaForm";

import {
  loginUser,
  requestRecoveryCode,
  verifyRecoveryCode,
  resetPassword,
} from "../services/postdateApi";

/* 🎛️ WHERE EACH KIND OF ACCOUNT LANDS AFTER LOGGING IN --------------------
   The key is the `role` the server sends back from loginUser().            */
const HOME_BY_ROLE = {
  user: "/dashboard",
  moderator: "/staff",
  admin: "/admin",
};

/* the big title for each view (Figma: LOG-IN / RECOVERY / PASSWORD) */
const TITLES = { login: "Log-in", recovery: "Recovery", password: "Password" };

/* if the server forgets to say how long a code lasts, assume 5 minutes */
const DEFAULT_CODE_SECONDS = 300;
const expiryFrom = (seconds) =>
  Date.now() + (Number(seconds) > 0 ? Number(seconds) : DEFAULT_CODE_SECONDS) * 1000;

function Login() {
  const navigate = useNavigate();

  const [verifyEmail, setVerifyEmail] = useState("");
  const [mfa, setMfa] = useState(null);
  const [view, setView] = useState("login"); // "login" | "recovery" | "password"
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState(0); // when the emailed code stops working
  const [resendAt, setResendAt] = useState(0);
  const [resetToken, setResetToken] = useState(""); // proof the code was right, kept in memory only
  const [notice, setNotice] = useState(""); // e.g. "Password updated" on the log-in view

  /* Clicking "Log in" in the header while you're already on this page starts
     over at the log-in view — the way out of the recovery screens. */
  const { key } = useLocation();
  useEffect(() => {
    setView("login");
    setMfa(null);
    setNotice("");
  }, [key]);

  // History navigation and direct visits must not show login to a signed-in user.
  if (isAuthenticated()) return <Navigate to={HOME_BY_ROLE[getRole()] || "/dashboard"} replace />;

  return (
    <div className="login public-page">
      <style>{`
        .login {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--pd-pink);
        }

        .login-main {
          flex: 1;
          padding: calc(30 * var(--u)) 0 calc(60 * var(--u));   /* 🎛️ space above / below the panel */
        }
        .login-main > .auth-panel { margin: 0 auto; }
      `}</style>

      <SiteNav />

      <main className="login-main">
        <aside className="login-welcome"><p className="public-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h2>A familiar face.<br />A new possibility.</h2><p>Pick up where you left off. Your next good conversation could be waiting.</p><div className="login-letter" aria-hidden="true"><span>A NOTE FOR YOU</span><strong>Good things<br />start with<br />a hello.</strong><i>♡</i><small>POSTDATE! / STAY CURIOUS</small></div><span className="login-welcome-foot">A little curiosity. A real connection.</span></aside>
        <AuthPanel title={TITLES[view]}>
          {mfa && <MfaForm pending={mfa} onCancel={() => setMfa(null)} onComplete={session => { setSession({ userId: session.userId, role: session.role }); navigate(HOME_BY_ROLE[session.role] || "/dashboard", { replace: true }); }} />}
          {view === "login" && !mfa && (
            <LoginForm
              defaultEmail={email}
              notice={notice}
              onSubmit={async ({ email, password }) => {
                try {
                  const session = await loginUser({ email, password });
                  if (session.mfaRequired) { setMfa(session); return; }
                  setSession(session);
                  navigate(HOME_BY_ROLE[session?.role] ?? "/dashboard", { replace: true });
                } catch (err) {
                  if (err?.response?.status === 403 && err.response.data.message === "Verify your email before logging in") {
                    setVerifyEmail(email);
                    return;
                  }
                  throw err;
                }
              }}
              onForgot={async (typedEmail) => {
                /* 🔌 BACKEND: POST /api/auth/recovery/request */
                const { expiresInSeconds, resendAfterSeconds = 60 } = await requestRecoveryCode(typedEmail);
                setEmail(typedEmail);
                setExpiresAt(expiryFrom(expiresInSeconds));
                setResendAt(Date.now() + resendAfterSeconds * 1000);
                setNotice("");
                setView("recovery");
              }}
            />
          )}

          {view === "recovery" && (
            <RecoveryForm
              email={email}
              expiresAt={expiresAt}
              resendAt={resendAt}
              onBack={() => { setResetToken(""); setExpiresAt(0); setView("login"); }}
              onVerify={async (code) => {
                /* 🔌 BACKEND: POST /api/auth/recovery/verify */
                const { resetToken: token } = await verifyRecoveryCode({ email, code });
                setResetToken(token);
                setView("password");
              }}
              onResend={async () => {
                /* 🔌 BACKEND: POST /api/auth/recovery/request (same route again) */
                const { expiresInSeconds, resendAfterSeconds = 60 } = await requestRecoveryCode(email);
                setExpiresAt(expiryFrom(expiresInSeconds));
                setResendAt(Date.now() + resendAfterSeconds * 1000);
              }}
            />
          )}

          {view === "password" && (
            <NewPasswordForm
              onSubmit={async (newPassword) => {
                /* 🔌 BACKEND: POST /api/auth/recovery/reset */
                await resetPassword({ resetToken, newPassword });
                setResetToken("");
                setSession(null);
                setNotice("Password updated. Log in");
                setView("login");
              }}
            />
          )}
        </AuthPanel>
      </main>

      <VerificationModal open={Boolean(verifyEmail)} email={verifyEmail}
        onClose={() => setVerifyEmail("")}
        onVerified={() => { setEmail(verifyEmail); setVerifyEmail(""); setNotice("Email verified. Log in to continue."); }} />
      <SiteFooter />
    </div>
  );
}

export default Login;
