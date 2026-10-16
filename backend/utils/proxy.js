function configureProxy(app, env = process.env) {
  const configured = env.TRUST_PROXY?.trim();
  if (configured) {
    app.set("trust proxy", /^\d+$/.test(configured) ? Number(configured) : configured.split(",").map(value => value.trim()));
  } else if (env.RENDER === "true" && env.NODE_ENV === "production") {
    // Render terminates public connections at its managed ingress. Trust
    // only the immediate hop; never trust every address in a supplied chain.
    app.set("trust proxy", 1);
  }
}
module.exports = { configureProxy };
