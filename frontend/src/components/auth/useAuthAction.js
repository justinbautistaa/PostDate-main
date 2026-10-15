import { useRef, useState } from "react";

/**
 * useAuthAction
 * The "busy / error" bookkeeping the log-in, recovery and new-password forms
 * share, so each form only has to say WHAT to call and WHAT to show if the
 * server says no.
 *
 *   const { busy, error, setError, run } = useAuthAction();
 *   run(() => onSubmit(values), "Wrong email or password");
 *
 * run() does three things:
 *   1. sets `busy` while the call is in flight (forms disable their buttons)
 *   2. if the SERVER answered with an error (401, 400, …) → shows a message.
 *      `failureMessage` is usually a fixed string, but can be a function
 *      `(err) => string` when the wording depends on which error came back —
 *      e.g. LoginForm shows different text for "wrong password" (401) than
 *      for "never verified your email" (403).
 *   3. if there was NO answer at all (backend not running, no network) → shows
 *      NETWORK_MESSAGE instead, so "the server is down" never gets mistaken
 *      for "wrong password" while the backend is still being built
 */
export const NETWORK_MESSAGE = "Can't reach the server";

export default function useAuthAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action, failureMessage = "Something went wrong") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {

      const message =
        typeof failureMessage === "function" ? failureMessage(err) : failureMessage;
      setError(err?.response ? message : NETWORK_MESSAGE);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
