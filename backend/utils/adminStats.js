const User = require("../models/User");
const Profile = require("../models/Profile");
const Match = require("../models/Match");
const Report = require("../models/Report");
const Appeal = require("../models/Appeal");
const Rating = require("../models/Rating");
const { seriesStart, buildDaySeries } = require("./adminHelpers");

const REPORT_STATUSES = ["pending", "reviewed", "resolved", "dismissed"];
const RANGE_OPTIONS = [7, 14, 30, 90];
const CATEGORIES = ["overall", "spice", "attentiveness", "respectfulness", "chemistry"];

async function getOverview() {
  const [activeCount, pendingReports, pendingAppeals] = await Promise.all([
    User.countDocuments({ role: "user", isActive: true, isVerified: true, lastActiveAt: { $gte: new Date(Date.now() - 300000) } }),
    Report.countDocuments({ status: "pending" }),
    Appeal.countDocuments({ status: "pending" }),
  ]);
  return { activeCount, pendingReports, pendingAppeals };
}

async function ratingSummary() {
  const averages = Object.fromEntries(CATEGORIES.map((key) => [key, { $avg: `$ratings.${key}` }]));
  const [result] = await Rating.aggregate([
    { $match: { isHidden: { $ne: true } } },
    { $facet: {
      summary: [{ $group: { _id: null, count: { $sum: 1 }, ...averages } }],
      distribution: [{ $group: { _id: { $round: ["$ratings.overall", 0] }, count: { $sum: 1 } } }],
    } },
  ]);
  const summary = result?.summary[0];
  const counts = new Map((result?.distribution || []).map((row) => [row._id, row.count]));
  return {
    count: summary?.count || 0,
    averages: Object.fromEntries(CATEGORIES.map((key) => [key, summary?.[key] ?? null])),
    distribution: [1, 2, 3, 4, 5].map((star) => ({ star, count: counts.get(star) || 0 })),
  };
}

async function daily(model, days, filter = {}) {
  return buildDaySeries(await model.aggregate([
    { $match: { ...filter, createdAt: { $gte: seriesStart(days) } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 } } },
  ]), days);
}

async function getStatistics(days) {
  const start = seriesStart(days);
  const previous = new Date(start.getTime() - days * 86400000);
  const trend = async (model, filter) => ({
    current: await model.countDocuments({ ...filter, createdAt: { $gte: start } }),
    previous: await model.countDocuments({ ...filter, createdAt: { $gte: previous, $lt: start } }),
  });
  const [overview, members, staff, matches, suspended, unverified, signups, matchSeries,
    memberTrend, matchTrend, ratings, reportGroups, reasons, genders, ages] = await Promise.all([
    getOverview(), User.countDocuments({ role: "user" }), User.countDocuments({ role: { $ne: "user" } }),
    Match.countDocuments({}), User.countDocuments({ role: "user", isActive: false }), User.countDocuments({ role: "user", isVerified: false }),
    daily(User, days, { role: "user" }), daily(Match, days), trend(User, { role: "user" }), trend(Match, {}), ratingSummary(),
    Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: "$reason", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    Profile.aggregate([{ $group: { _id: "$gender", count: { $sum: 1 } } }]),
    Profile.aggregate([
      { $project: { age: { $dateDiff: { startDate: "$dateOfBirth", endDate: "$$NOW", unit: "year" } } } },
      { $bucket: { groupBy: "$age", boundaries: [18, 25, 35, 45, 55, 150], default: "Other", output: { count: { $sum: 1 } } } },
    ]),
  ]);
  const reportMap = new Map(reportGroups.map((row) => [row._id, row.count]));
  const ageLabels = { 18: "18–24", 25: "25–34", 35: "35–44", 45: "45–54", 55: "55+" };
  return {
    range: days,
    totals: { members, staff, matches, suspended, unverified, activeNow: overview.activeCount, pendingReports: overview.pendingReports, pendingAppeals: overview.pendingAppeals },
    trends: { members: memberTrend, matches: matchTrend },
    series: { signups, matches: matchSeries },
    reports: { byStatus: Object.fromEntries(REPORT_STATUSES.map((key) => [key, reportMap.get(key) || 0])), byReason: reasons.map((row) => ({ reason: row._id, count: row.count })) },
    ratings,
    audience: { gender: genders.map((row) => ({ label: row._id, count: row.count })), age: ages.map((row) => ({ label: ageLabels[row._id] || "Other", count: row.count })) },
  };
}

module.exports = { REPORT_STATUSES, RANGE_OPTIONS, getOverview, getStatistics, ratingSummary };
