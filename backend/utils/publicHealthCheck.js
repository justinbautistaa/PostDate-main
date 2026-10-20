async function checkPublicHealth({ fetchImpl = fetch, attempts = 3, timeoutMs = 30000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchImpl("https://postdate.onrender.com/healthz", {
        redirect: "error", signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok && (await response.json()).status === "ready") return true;
    } catch { /* Allow bounded retries for transient failures and cold starts. */ }
  }
  return false;
}
module.exports = { checkPublicHealth };
