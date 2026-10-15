/**
 * SettingsTab — the dark panel behind the gear tab.
 *
 * The Figma only blocks this out with the words "settings stuff", so that is
 * what renders by default. Pass children to drop the real controls in without
 * touching any styling:
 *
 *   <SettingsTab>
 *     <label>...</label>
 *     <button>Delete account</button>
 *   </SettingsTab>
 */
import { Link } from "react-router-dom";
import BlockedPeople from "./BlockedPeople";
import PushSettings from "./PushSettings";
import MfaSettings from "./MfaSettings";
import DeleteAccount from "./DeleteAccount";
import PrivacySettings from "./PrivacySettings";

export default function SettingsTab({ children }) {
  return (
    <div className="settings">
      <style>{`
        .settings {
          height: 100%;
          display: grid;
          place-items: center;

          font-family: var(--pd-mono);
          color: var(--pd-white);
        }

        /* 🎛️ the placeholder wording and size — delete once real settings land */
        .settings-placeholder {
          margin: 0;
          font-size: clamp(24px, 4.5vw, 84px);
          line-height: 1.25;
          text-align: center;
          opacity: 0.9;
        }

        /* styling that real settings content inherits */
        .settings-content {
          width: 100%;
          align-self: start;
          display: flex;
          flex-direction: column;
          gap: clamp(10px, 1.4vw, 20px);
          font-size: clamp(11px, 1vw, 17px);
        }
      `}</style>

      {children ? (
        <div className="settings-content">{children}</div>
      ) : (
        <div className="settings-content member-settings">
          <h2>Account and privacy</h2>
          <MfaSettings />
          <PrivacySettings />
          <BlockedPeople />
          <PushSettings />
          <DeleteAccount />
          <section><h3>Password recovery</h3><p>Use your registered email to receive a recovery code and choose a new password.</p><Link to="/login">Open login and password recovery →</Link></section>
          <section><h3>Your public profile</h3><p>Your name, photos, bio, and selected interests are visible to other members. Your email and password stay private. Use Edit profile and Photos to update what you share.</p></section>
          <section><h3>Plan at your own pace</h3><p>Your date plans are private to your account. Keep places, dates, and personal reminders together.</p><Link to="/dashboard#date-planner">Open your date planner →</Link></section>
        </div>
      )}
    </div>
  );
}
