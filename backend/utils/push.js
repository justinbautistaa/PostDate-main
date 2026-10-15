const webpush = require("web-push");
const Subscription = require("../models/PushSubscription");
const User = require("../models/User");
const configured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
function validEndpoint(value) {
  try { const url = new URL(value); return value.length < 2048 && url.protocol === "https:" && !url.username && !url.password && !url.hash && (!url.port || url.port === "443") && (url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" || url.hostname.endsWith(".push.apple.com") || url.hostname.endsWith(".notify.windows.com")); } catch { return false; }
}
async function sendPush(userId, { title, url }) {
  if (!configured()) return;
  const user = await User.findOne({ _id: userId, isActive: true, isVerified: true }).select("sessionVersion").lean();
  if (!user) return;
  const rows = await Subscription.find({ userId, sessionVersion: user.sessionVersion || 0 }).limit(10).lean();
  await Promise.allSettled(rows.map(async row => {
    if (!validEndpoint(row.endpoint)) return;
    try { await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, JSON.stringify({ title, body: "Open PostDate to view your update.", url }), { vapidDetails: { subject: process.env.VAPID_SUBJECT, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }, TTL: 300, timeout: 5000 }); }
    catch (error) { if ([404, 410].includes(error.statusCode)) await Subscription.deleteOne({ _id: row._id }); }
  }));
}
module.exports = { configured, validEndpoint, sendPush };
