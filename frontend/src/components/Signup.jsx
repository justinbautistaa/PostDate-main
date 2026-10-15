import { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import FormStepper from "../components/FormStepper";
import WhoAreYouForm from "../components/WhoAreYouForm";
import PhotosForm from "../components/PhotosForm";
import YourTasteForm from "../components/YourTasteForm";
import SignupAside from "../components/SignupAside";

function Signup() {
  const [status, setStatus] = useState("Checking connection...");
  const [step, setStep] = useState(1);
  const [signupData, setSignupData] = useState({});

  useEffect(() => {
    api
      .get("/")
      .then(() => setStatus("Connected to backend ✅"))
      .catch(() =>
        setStatus("Could not reach the backend. Is the server running?")
      );
  }, []);

  return (
    <div className="page-container">
      <Navbar />
      <main>
        <div className="signup-page-content">
          <style>{`
            /* 🎛️ TUNE THE PAGE LAYOUT HERE -------------------------- */
            .signup-page-content {
              max-width: 1000px;
              padding: 0 40px 60px;
              /* no margin:auto here on purpose — this anchors everything to
                 the left, matching the sample, instead of centering it */
            }
            .signup-layout {
              display: flex;
              flex-wrap: wrap;
              align-items: flex-start;
              justify-content: flex-start; /* was "center" — that's what caused the floating-in-the-middle look */
              gap: 32px;              /* space between card and aside */
            }
            .signup-form-col {
              flex: 0 1 440px;        /* matches StampCardShell's --stamp-width (400) + its own padding */
              min-width: 300px;
            }
            .signup-layout > .aside-wrapper {
              flex: 1 1 300px;
              max-width: 340px;       /* matches SignupAside's --aside-width */
            }
            /* ---------------------------------------------------------- */
          `}</style>

          <FormStepper currentStep={step} />

          <div className="signup-layout">
            <div className="signup-form-col">
              {step === 1 && (
                <WhoAreYouForm
                  step={1}
                  onContinue={(data) => {
                    setSignupData((prev) => ({ ...prev, ...data }));
                    setStep(2);
                  }}
                />
              )}

              {step === 2 && (
                <PhotosForm
                  step={2}
                  onContinue={(photos) => {
                    setSignupData((prev) => ({ ...prev, photos }));
                    setStep(3);
                  }}
                />
              )}

              {step === 3 && (
                <YourTasteForm
                  step={3}
                  onConfirm={(tags) => {
                    const fullSignup = { ...signupData, tags };
                    // Credentials must never be logged.
                    // TODO: send it to your backend, e.g.
                    // api.post("/signup", fullSignup).then(() => navigate("/welcome"));
                  }}
                />
              )}
            </div>

            <SignupAside step={step} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default Signup;
