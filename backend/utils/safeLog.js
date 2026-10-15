// Never serialize errors, request URLs, query strings, headers, or bodies.
function safeLog(event) { console.error(`[PostDate] ${event}`); }
module.exports = { safeLog };
