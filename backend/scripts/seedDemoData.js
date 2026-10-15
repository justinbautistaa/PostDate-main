/**
 * seedDemoData
 * Fills the database with believable fake data so the admin dashboard has
 * something to chart: ~64 members signing up over the last 60 days, matches,
 * ratings (a few hidden), reports in every state, suspended members, appeals,
 * and the staff activity trail that goes with them.
 *
 *   npm run seed:demo              first time
 *   npm run seed:demo -- --reset   wipe the previous demo data and re-seed
 *
 * Everything it creates uses an email ending in @demo.postdate.test, which is
 * how --reset finds (and removes) only its own rows. Real accounts are never
 * touched.
 *
 * Demo accounts get a hash of a random string nobody knows, so they can't be
 * logged into. They're there to be looked at, not used.
 *
 * Refuses to run when NODE_ENV=production unless you also pass --force.
 *
 * Note: "Active now" counts activity from the last 5 minutes, so the handful
 * of demo members stamped as active right now fade out of that number (and
 * the header counter) a few minutes after you seed. That's the counter
 * working correctly, not the seed breaking.
 */
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../models/User");
const Profile = require("../models/Profile");
const Match = require("../models/Match");
const Rating = require("../models/Rating");
const Report = require("../models/Report");
const Appeal = require("../models/Appeal");
const AuditLog = require("../models/AuditLog");
const { PERSONALITY_OPTIONS } = require("../utils/tasteOptions");

const DEMO_DOMAIN = "demo.postdate.test";
const DEMO_EMAIL = new RegExp(`@${DEMO_DOMAIN.replace(/\./g, "\\.")}$`);
const MEMBER_COUNT = 64;
const HISTORY_DAYS = 60;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const NOW = Date.now();

/* A seeded random number generator, so every run produces the same data. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260930);
const chance = (p) => rand() < p;
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (list) => list[Math.floor(rand() * list.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
};
const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const clampDate = (ms) => new Date(Math.min(ms, NOW - 60 * 1000));

const FIRST_NAMES = [
  "Alex", "Priya", "Jordan", "Sam", "Maya", "Devon", "Lena", "Theo", "Nina", "Marcus",
  "Yuki", "Casey", "Isabel", "Owen", "Ravi", "Zoe", "Ash", "Delilah", "Amara", "Luca",
  "Hana", "Jonas", "Imani", "Felix", "Sofia", "Kai", "Noor", "Elliot", "Mei", "Diego",
  "Tamsin", "Arjun", "Wren", "Bastien", "Leila", "Callum", "Esme", "Rohan", "Freya", "Mateo",
];
const LAST_NAMES = [
  "Okafor", "Nguyen", "Brandt", "Castillo", "Haddad", "Lindqvist", "Moreau", "Patel", "Rossi", "Tanaka",
  "Adeyemi", "Kowalski", "Fernandes", "Hughes", "Ibrahim", "Jensen", "Kaplan", "Lopez", "Mbeki", "Novak",
  "Ortega", "Petrov", "Quinn", "Reyes", "Sato", "Thompson", "Uddin", "Varga", "Walsh", "Yilmaz",
];
const CITIES = [
  ["Austin", "US"], ["Portland", "US"], ["Chicago", "US"], ["Denver", "US"], ["Toronto", "CA"],
  ["Manchester", "GB"], ["Melbourne", "AU"], ["Seattle", "US"],
];
const BIOS = [
  "Weekend hiker, weekday coffee snob.",
  "Will always pick the restaurant with the weirdest menu.",
  "Board games, bad puns, good playlists.",
  "Looking for someone to argue about films with.",
  "Dog person who is trying very hard to be a plant person.",
  "Cooks too much, shares generously.",
  "Live music most weeks. Front row or nothing.",
];

const REASONS = [
  ["Harassment", 30], ["Fake profile", 24], ["Spam or scam", 20], ["Inappropriate photos", 14],
  ["Threats or violence", 5], ["Underage", 3], ["Other", 8],
];
const REPORT_TEXT = {
  Harassment: [
    "Kept messaging after I said I wasn't interested. Over a dozen messages in one night.",
    "Sent me increasingly aggressive messages when I stopped replying.",
    "Wouldn't take no for an answer and started messaging at all hours.",
  ],
  "Fake profile": [
    "Photos look like they were taken from someone else's social media.",
    "Profile says one thing, messages say another. I think this is a catfish.",
    "Every photo is a different person.",
  ],
  "Spam or scam": [
    "Asked me to move to another app straight away and then sent a payment link.",
    "Sent the same message with a link to a crypto site to everyone I know here.",
    "Said they were stuck abroad and needed money for a flight.",
  ],
  "Inappropriate photos": ["Sent explicit photos I never asked for.", "Profile photo is not appropriate for a dating site."],
  "Threats or violence": ["Said they knew where I lived after I unmatched."],
  Underage: ["Their messages say they're still at school."],
  Other: ["Something felt off about this account. Hard to explain.", "Pretending to be someone's ex, I think."],
};
const RESOLUTION_NOTES = [
  "Confirmed in the message history.",
  "Checked the photos, they are not the account holder's.",
  "Warning sent. No further action needed.",
  "Duplicate of an earlier report.",
  "Not enough to act on. Keep an eye on the account.",
  "Evidence reviewed, account actioned.",
];
const COMMENTS = {
  high: [
    "Great conversation, we ended up closing the café.",
    "Funny, kind, and actually listened.",
    "Showed up early and planned a lovely evening.",
    "Easy to talk to. Would happily go again.",
    "Thoughtful with a great sense of humour.",
  ],
  mid: [
    "Nice enough evening, we didn't quite click.",
    "Pleasant, but the chemistry wasn't there.",
    "Good company, a little distracted by their phone.",
  ],
  low: [
    "Arrived forty minutes late with no message.",
    "Kept steering the conversation back to themselves.",
    "Not what the profile photos suggested.",
    "Left early without really saying why.",
  ],
  rude: [
    "Total waste of my time. Boring and rude, avoid.",
    "Honestly one of the worst people I've met on here.",
  ],
};

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed demo data with NODE_ENV=production (pass --force if you really mean it).");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — check backend/.env.");
  await mongoose.connect(process.env.MONGO_URI);

  /* ── existing demo data? ─────────────────────────────────────────────── */
  const existing = await User.find({ email: DEMO_EMAIL }).select("_id").lean();
  if (existing.length > 0) {
    if (!process.argv.includes("--reset")) {
      throw new Error(`Demo data is already there (${existing.length} accounts). Re-run with --reset to replace it.`);
    }
    const ids = existing.map((u) => u._id);
    await Promise.all([
      Profile.deleteMany({ userId: { $in: ids } }),
      Match.deleteMany({ $or: [{ user1: { $in: ids } }, { user2: { $in: ids } }] }),
      Rating.deleteMany({ $or: [{ reviewerId: { $in: ids } }, { reviewedUserId: { $in: ids } }] }),
      Report.deleteMany({ $or: [{ reporterId: { $in: ids } }, { reportedUserId: { $in: ids } }] }),
      Appeal.deleteMany({ userId: { $in: ids } }),
      AuditLog.deleteMany({ actorId: { $in: ids } }),
    ]);
    await User.deleteMany({ _id: { $in: ids } });
    console.log(`Removed ${ids.length} demo accounts and everything attached to them.`);
  }

  // A hash of a string nobody knows: demo accounts can't be logged into.
  const lockedHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 8);

  /* ── staff who "did" the moderation work ─────────────────────────────── */
  const mods = await User.insertMany(
    [["Maya", "Okafor"], ["Theo", "Brandt"]].map(([firstName, lastName], i) => ({
      email: `${firstName}.${lastName}@${DEMO_DOMAIN}`.toLowerCase(),
      passwordHash: lockedHash,
      firstName,
      lastName,
      role: "moderator",
      isVerified: true,
      createdAt: new Date(NOW - (HISTORY_DAYS + 5 + i) * DAY),
      lastActiveAt: new Date(NOW - 3 * HOUR),
    }))
  );

  /* ── members, signing up faster and faster ───────────────────────────── */
  const usedNames = new Set();
  const memberDocs = [];
  for (let i = 0; i < MEMBER_COUNT; i += 1) {
    let first;
    let last;
    do {
      first = pick(FIRST_NAMES);
      last = pick(LAST_NAMES);
    } while (usedNames.has(`${first} ${last}`));
    usedNames.add(`${first} ${last}`);

    // pow(r, 1.7) piles signups toward "now": the growth curve.
    const joinedAt = NOW - Math.floor(Math.pow(rand(), 1.7) * HISTORY_DAYS * DAY) - 10 * 60 * 1000;
    const activity = rand();
    memberDocs.push({
      email: `${first}.${last}.${i}@${DEMO_DOMAIN}`.toLowerCase(),
      passwordHash: lockedHash,
      firstName: first,
      lastName: last,
      role: "user",
      isVerified: chance(0.92),
      createdAt: new Date(joinedAt),
      lastActiveAt:
        activity < 0.2 ? new Date(NOW - int(10, 220) * 1000) // active just now
        : activity < 0.75 ? clampDate(NOW - int(1, 72) * HOUR)
        : clampDate(joinedAt + int(1, 20) * DAY),
    });
  }
  const members = await User.insertMany(memberDocs);

  await Profile.insertMany(
    members.map((m) => {
      const [city, country] = pick(CITIES);
      return {
        userId: m._id,
        dateOfBirth: new Date(Date.UTC(NOW_YEAR() - int(19, 48), int(0, 11), int(1, 28))),
        gender: weighted([["female", 42], ["male", 40], ["nonbinary", 10], ["self-describe", 3], ["prefer-not-to-say", 5]]),
        bio: pick(BIOS),
        location: { city, country },
        interests: shuffle(PERSONALITY_OPTIONS).slice(0, int(3, 5)),
        photos: [],
        avatar: null,
        createdAt: m.createdAt,
      };
    })
  );

  /* ── matches ─────────────────────────────────────────────────────────── */
  const verified = members.filter((m) => m.isVerified);
  const pairSeen = new Set();
  const matchDocs = [];
  while (matchDocs.length < 110) {
    const a = pick(verified);
    const b = pick(verified);
    if (a._id.equals(b._id)) continue;
    const key = [String(a._id), String(b._id)].sort().join(":");
    if (pairSeen.has(key)) continue;
    pairSeen.add(key);
    const earliest = Math.max(a.createdAt.getTime(), b.createdAt.getTime()) + int(2, 60) * HOUR;
    if (earliest > NOW - HOUR) continue;
    matchDocs.push({
      user1: a._id,
      user2: b._id,
      status: weighted([["active", 88], ["unmatched", 9], ["blocked", 3]]),
      createdAt: new Date(earliest + int(0, Math.max(0, Math.floor((NOW - HOUR - earliest) / HOUR))) * HOUR * 0.5),
    });
  }
  const matches = await Match.insertMany(matchDocs);

  /* ── ratings: each member has a hidden "how nice are they" level ─────── */
  const niceness = new Map(members.map((m) => [String(m._id), 2.4 + rand() * 2.5]));
  const score = (base) => Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5) * 1.6)));
  const ratingSeen = new Set();
  const ratingDocs = [];
  for (const match of matches) {
    const directions = chance(0.35) ? [[match.user1, match.user2], [match.user2, match.user1]] : chance(0.75) ? [chance(0.5) ? [match.user1, match.user2] : [match.user2, match.user1]] : [];
    for (const [reviewer, reviewed] of directions) {
      const key = `${reviewer}:${reviewed}`;
      if (ratingSeen.has(key)) continue;
      ratingSeen.add(key);
      const base = niceness.get(String(reviewed));
      const overall = score(base);
      const tier = overall >= 4 ? "high" : overall === 3 ? "mid" : "low";
      ratingDocs.push({
        reviewerId: reviewer,
        reviewedUserId: reviewed,
        matchId: match._id,
        ratings: {
          overall,
          spice: score(base - 0.3),
          attentiveness: score(base),
          respectfulness: score(base + 0.3),
          chemistry: score(base - 0.1),
        },
        comment: chance(0.7) ? pick(COMMENTS[tier]) : "",
        createdAt: clampDate(match.createdAt.getTime() + int(1, 6) * DAY),
      });
    }
  }
  // A couple of ratings that deserve to be hidden.
  const rudeOnes = ratingDocs.filter((r) => r.ratings.overall <= 2).slice(0, 3);
  rudeOnes.forEach((r) => {
    r.comment = pick(COMMENTS.rude);
  });
  const ratings = await Rating.insertMany(ratingDocs);

  /* ── reports in every state ──────────────────────────────────────────── */
  const statusPlan = [
    ...Array(10).fill("pending"), ...Array(4).fill("reviewed"),
    ...Array(9).fill("resolved"), ...Array(5).fill("dismissed"),
  ];
  const reportDocs = shuffle(statusPlan).map((status) => {
    const reporter = pick(members);
    let reported = pick(members);
    while (reported._id.equals(reporter._id)) reported = pick(members);
    const reason = weighted(REASONS);
    const createdMs = NOW - Math.floor(Math.pow(rand(), 1.4) * 30 * DAY) - HOUR;
    const handler = pick(mods);
    const done = status === "resolved" || status === "dismissed";
    return {
      reporterId: reporter._id,
      targetType: chance(0.78) ? "user" : "message",
      targetId: new mongoose.Types.ObjectId(),
      reportedUserId: reported._id,
      reason,
      description: pick(REPORT_TEXT[reason]),
      status,
      resolvedBy: status === "pending" ? null : handler._id,
      resolutionNote: status === "pending" ? "" : pick(RESOLUTION_NOTES),
      resolvedAt: done ? clampDate(createdMs + int(2, 70) * HOUR) : null,
      createdAt: new Date(createdMs),
      _handler: handler,
    };
  });
  // targetId must be the reported user's id for user-type reports
  reportDocs.forEach((r) => {
    if (r.targetType === "user") r.targetId = r.reportedUserId;
  });
  const reports = await Report.insertMany(reportDocs.map(({ _handler, ...doc }) => doc));
  const handlerOf = new Map(reportDocs.map((r, i) => [String(reports[i]._id), r._handler]));

  /* ── suspensions + appeals ───────────────────────────────────────────── */
  const suspendedIds = new Set();
  const suspensions = []; // { user, at, reason, by }
  for (const report of reports.filter((r) => r.status === "resolved")) {
    if (suspensions.length >= 7) break;
    const uid = String(report.reportedUserId);
    if (suspendedIds.has(uid)) continue;
    suspendedIds.add(uid);
    suspensions.push({
      userId: report.reportedUserId,
      at: report.resolvedAt,
      reason: `${report.reason}: confirmed after review`,
      by: handlerOf.get(String(report._id)),
    });
  }
  for (let i = 0; i < suspensions.length; i += 1) {
    const s = suspensions[i];
    const reinstated = i === 4; // this one won an appeal
    await User.updateOne(
      { _id: s.userId },
      reinstated
        ? { $set: { isActive: true } }
        : { $set: { isActive: false, suspendedAt: s.at, suspensionReason: s.reason, suspendedBy: s.by._id } }
    );
  }

  const appealPlan = [
    [0, "pending"], [1, "pending"], [2, "pending"], [3, "denied"], [4, "approved"],
  ];
  const appealMessages = [
    "I think there's been a mix-up. I was only replying to messages that were sent to me first.",
    "I'm sorry if I came across badly. I didn't mean to upset anyone and I'd like a second chance.",
    "That photo was mine, I can send ID to prove it. Please look again.",
    "I understand the rule now and it won't happen again.",
    "My account was hacked that week. I can show the security email.",
  ];
  const auditDocs = [];
  const appealDocs = [];
  appealPlan.forEach(([idx, status]) => {
    const s = suspensions[idx];
    if (!s) return;
    const createdMs = clampDate(s.at.getTime() + int(3, 30) * HOUR).getTime();
    const decider = pick(mods);
    appealDocs.push({
      userId: s.userId,
      message: appealMessages[idx],
      status,
      decidedBy: status === "pending" ? null : decider._id,
      decisionNote: status === "denied" ? "Messages in the report speak for themselves." : status === "approved" ? "Evidence supports the appeal." : "",
      decidedAt: status === "pending" ? null : clampDate(createdMs + int(5, 40) * HOUR),
      createdAt: new Date(createdMs),
    });
    if (status === "approved") {
      auditDocs.push({ actor: decider, action: "appeal.approve", targetType: "appeal", at: clampDate(createdMs + 20 * HOUR), summary: "Approved an appeal and reinstated the member" });
    }
    if (status === "denied") {
      auditDocs.push({ actor: decider, action: "appeal.deny", targetType: "appeal", at: clampDate(createdMs + 20 * HOUR), summary: "Denied an appeal: Messages in the report speak for themselves." });
    }
  });
  const appeals = await Appeal.insertMany(appealDocs);

  /* ── hide the rude ratings ───────────────────────────────────────────── */
  const rudeIds = ratings.filter((r) => COMMENTS.rude.includes(r.comment)).map((r) => r._id);
  for (const id of rudeIds) {
    const by = pick(mods);
    const at = clampDate(NOW - int(1, 9) * DAY);
    await Rating.updateOne(
      { _id: id },
      { $set: { isHidden: true, hiddenReason: "Personal insults, not a review of the date", hiddenBy: by._id, hiddenAt: at } }
    );
    auditDocs.push({ actor: by, action: "rating.hide", targetType: "rating", targetId: id, at, summary: "Hid a rating: Personal insults, not a review of the date" });
  }

  /* ── the staff activity trail ────────────────────────────────────────── */
  reports.forEach((r) => {
    if (r.status === "pending") return;
    const by = handlerOf.get(String(r._id));
    auditDocs.push({
      actor: by,
      action: "report.update",
      targetType: "report",
      targetId: r._id,
      at: r.resolvedAt ?? clampDate(r.createdAt.getTime() + 5 * HOUR),
      summary: `Moved a report (${r.reason}) from pending to ${r.status}: ${r.resolutionNote}`,
    });
  });
  suspensions.forEach((s) => {
    auditDocs.push({ actor: s.by, action: "user.suspend", targetType: "user", targetId: s.userId, at: s.at, summary: `Suspended a member: ${s.reason}` });
  });
  if (suspensions[4]) {
    auditDocs.push({ actor: pick(mods), action: "user.reinstate", targetType: "user", targetId: suspensions[4].userId, at: clampDate(suspensions[4].at.getTime() + 2 * DAY), summary: "Reinstated a member after an appeal" });
  }
  await AuditLog.insertMany(
    auditDocs.map((e) => ({
      actorId: e.actor._id,
      actorRole: "moderator",
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId ?? new mongoose.Types.ObjectId(),
      summary: e.summary,
      createdAt: e.at,
    }))
  );

  console.log("✔ Demo data ready:");
  console.log(`   ${members.length} members, ${mods.length} moderators`);
  console.log(`   ${matches.length} matches, ${ratings.length} ratings (${rudeIds.length} hidden)`);
  const stillSuspended = suspensions.length - (suspensions[4] ? 1 : 0);
  console.log(`   ${reports.length} reports, ${stillSuspended} suspended members, ${appeals.length} appeals`);
  console.log(`   ${auditDocs.length} staff activity entries`);
}

function NOW_YEAR() {
  return new Date(NOW).getUTCFullYear();
}

main()
  .catch((err) => {
    console.error("Demo seed failed. Check configuration and input.");
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
