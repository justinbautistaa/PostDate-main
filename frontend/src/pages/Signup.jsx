/**
 * Signup — the three-step stamp form, plus the mandatory email-verification
 * pop-up that follows it.
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ POSTDATE!                              HOME  LOG IN  …    │  SiteNav
 *   ├────────────────────────────────────────────────────────────┤
 *   │ (1)─ WHO ARE YOU? ────────▶ (2) PHOTOS ────────▶ (3) TASTE │  FormStepper
 *   │                                                            │  (one long bar)
 *   │  ┌─ stamp card ─┐            WHY WE ASK                    │
 *   │  │  636 x 634   │            ┌──────────┐ ┌────────────┐   │
 *   │  │   (square)   │            │ profile  │ │  profile   │   │  SignupAside
 *   │  │              │            │  card    │ │   page     │   │
 *   │  └──────────────┘            └──────────┘ └────────────┘   │
 *   └────────────────────────────────────────────────────────────┘
 *                          step 3 "Confirm!" succeeds
 *                                     │
 *                                     ▼
 *                     ┌───────────────────────────────┐
 *                     │  VerificationModal — mandatory │
 *                     │  (no ✕, no Esc, no backdrop    │
 *                     │   click — see the note below)  │
 *                     └───────────────┬─────────────────┘
 *                                     │ onVerified
 *                                     ▼
 *                               navigate("/profile")
 *
 * 🎛️ THIS PAGE IS A FIXED LAYOUT, NOT A RESPONSIVE ONE. Everything on it is
 * sized in Figma pixels: `calc(<Figma px> * var(--u))`. --u is "one Figma
 * pixel on your screen" and is the ONLY number you need to change to make the
 * page bigger or smaller. It lives in src/theme.css and is shared with the
 * log-in page, so the two always match.
 *
 * Step state lives here; each step component just reports its own values back
 * up through onContinue / onConfirm. Nothing is sent to the server until the
 * last step, so a user can go back and forth without half-saving a profile.
 *
 * Verification sends a unique expiring email code. After confirmation,
 * users log in to establish the server-managed cookie session.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import FormStepper from "../components/FormStepper";
import WhoAreYouForm from "../components/WhoAreYouForm";
import PhotosForm from "../components/PhotosForm";
import YourTasteForm from "../components/YourTasteForm";
import SignupGuide from "../components/SignupGuide";
import VerificationModal from "../components/VerificationModal";

import { submitSignup } from "../services/postdateApi";
import "./PublicPages.css";
import "./Signup.css";

function Signup() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [signupData, setSignupData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showVerify, setShowVerify] = useState(false);

  async function handleFinish(tags) {
    const fullSignup = { ...signupData, tags, privacyConsent: true };
    setSubmitting(true);
    setError("");

    try {
      /* 🔌 BACKEND: POST /api/signup — see services/postdateApi.js. */
      await submitSignup(fullSignup);
      /* Account created, but not usable yet — see the 🔌 VERIFICATION note
         above. VerificationModal (rendered below) takes it from here. */
      setShowVerify(true);
    } catch (err) {
      setError(
        err?.response?.status === 409
          ? "An account with that email already exists. Try logging in instead."
          : [400, 413, 429, 503].includes(err?.response?.status) && typeof err?.response?.data?.message === "string"
            ? err.response.data.message
            : "We could not create your profile. Please try again. If it continues, contact the site owner."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signup public-page">
      <style>{`
        .signup {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--pd-pink);
        }

        .signup-main {
          flex: 1;
          padding-bottom: calc(60 * var(--u));
        }

        /* One block, centred on the page. Figma: stamp left edge (x=96) to the
           aside's right edge (x=1806) = 1710 wide. The stepper fills all of it. */
        .signup-stage {
          width: calc(1710 * var(--u));
          margin: 0 auto;
        }

        /* Figma: stepper circles start 29px under the header line */
        .signup-stepper {
          padding-top: calc(29 * var(--u));
        }

        /* Row 2: the two big boxes. Card hugs the left, aside hugs the right. */
        .signup-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-top: calc(27 * var(--u));
        }
        .signup-card-slot {
          flex: none;
          margin-top: calc(9 * var(--u));   /* Figma: card top sits 9px below the aside's top */
        }

        .signup-error {
          margin: calc(16 * var(--u)) 0 0;
          font-family: var(--pd-mono);
          font-size: calc(16 * var(--u));
          color: var(--pd-maroon);
          text-align: center;
        }
      `}</style>

      <SiteNav />

      <main className="signup-main">
        <div className="signup-intro"><p className="public-eyebrow">A LITTLE CURIOSITY. A REAL CONNECTION.</p><h1>Your next chapter starts here.</h1><p>Create your profile, share a little about yourself, and find your people.</p></div>
        <div className="signup-stage">
          <div className="signup-stepper">
            <FormStepper currentStep={step} />
          </div>

          <div className="signup-row">
            <div className="signup-card-slot">
              {step === 1 && (
                <WhoAreYouForm
                  initialValues={signupData}
                  step={1}
                  onContinue={(data) => {
                    setSignupData((prev) => ({ ...prev, ...data }));
                    setStep(2);
                  }}
                />
              )}

              {step === 2 && (
                <PhotosForm
                  initialFiles={signupData.photos || []}
                  onBack={() => setStep(1)}
                  step={2}
                  onContinue={(photos) => {
                    setSignupData((prev) => ({ ...prev, photos }));
                    setStep(3);
                  }}
                />
              )}

              {step === 3 && (
                <YourTasteForm
                  onBack={() => setStep(2)}
                  step={3}
                  onConfirm={handleFinish}
                  disabled={submitting || showVerify}
                  buttonLabel={submitting ? "Creating account…" : "Create account"}
                />
              )}
            </div>

            <SignupGuide step={step} profile={signupData} />
          </div>

          {error && <p className="signup-error" role="alert">{error}</p>}
          <p className="signup-login">Already have an account? <Link to="/login">Log in</Link></p>
        </div>
      </main>

      <SiteFooter><span>A little curiosity. A real connection.</span></SiteFooter>

      <VerificationModal
        open={showVerify}
        email={signupData.email}
        successMessage="You successfully created an account"
        codeLength={6}
        onVerified={() => navigate("/login")}
      />
    </div>
  );
}

export default Signup;
