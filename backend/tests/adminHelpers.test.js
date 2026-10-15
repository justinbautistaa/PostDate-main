/**
 * Unit tests for utils/adminHelpers.js — pure functions, so no database and
 * no mongodb-memory-server needed. These are the pieces that sit between
 * "text typed in a search box" and "a MongoDB query", which is why they get
 * their own tests.
 */
const {
  escapeRegex,
  asString,
  isObjectIdString,
  parsePage,
  pageInfo,
  buildDaySeries,
  seriesStart,
  maskEmail,
  fullName,
  clip,
} = require("../utils/adminHelpers");

describe("escapeRegex", () => {
  test("turns regex metacharacters into literals", () => {
    const rx = new RegExp(escapeRegex("a.b*c(d)[e]"), "i");
    expect(rx.test("a.b*c(d)[e]")).toBe(true);
    expect(rx.test("axbbbcd e")).toBe(false);
  });

  test("'.*' no longer matches everything", () => {
    expect(new RegExp(escapeRegex(".*")).test("anything at all")).toBe(false);
  });
});

describe("asString", () => {
  test("passes strings through, clipped", () => {
    expect(asString("hello", 3)).toBe("hel");
  });

  test("returns '' for anything that isn't a string (this is what stops ?q[$ne]=x)", () => {
    expect(asString({ $ne: "x" })).toBe("");
    expect(asString(["a"])).toBe("");
    expect(asString(undefined)).toBe("");
    expect(asString(42)).toBe("");
  });
});

describe("isObjectIdString", () => {
  test("accepts a real 24-hex id", () => {
    expect(isObjectIdString("507f1f77bcf86cd799439011")).toBe(true);
  });

  test("rejects the things mongoose.isValidObjectId lets through", () => {
    expect(isObjectIdString("aaaaaaaaaaaa")).toBe(false); // any 12 characters
    expect(isObjectIdString("not-an-id")).toBe(false);
    expect(isObjectIdString({ $gt: "" })).toBe(false);
    expect(isObjectIdString(undefined)).toBe(false);
  });
});

describe("parsePage", () => {
  test("defaults", () => {
    expect(parsePage({})).toEqual({ page: 1, limit: 15, skip: 0 });
  });

  test("computes skip", () => {
    expect(parsePage({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  test("clamps nonsense", () => {
    expect(parsePage({ page: "-4", limit: "0" }).page).toBe(1);
    expect(parsePage({ limit: "99999" }).limit).toBe(50);
    expect(parsePage({ page: "999999999" }).page).toBe(10000);
    expect(parsePage({ page: { $gt: 1 }, limit: ["5"] }).page).toBe(1);
  });
});

describe("pageInfo", () => {
  test("never reports fewer than one page", () => {
    expect(pageInfo(0, { page: 1, limit: 10 }).pages).toBe(1);
    expect(pageInfo(25, { page: 1, limit: 10 }).pages).toBe(3);
  });
});

describe("buildDaySeries", () => {
  const now = new Date("2026-10-02T15:30:00Z");

  test("fills the gaps with zeros, oldest day first, ending today", () => {
    const series = buildDaySeries([{ _id: "2026-10-02", count: 4 }, { _id: "2026-09-30", count: 1 }], 4, now);
    expect(series).toEqual([
      { date: "2026-09-29", count: 0 },
      { date: "2026-09-30", count: 1 },
      { date: "2026-10-01", count: 0 },
      { date: "2026-10-02", count: 4 },
    ]);
  });

  test("returns exactly `days` entries", () => {
    expect(buildDaySeries([], 90, now)).toHaveLength(90);
  });

  test("ignores rows outside the window", () => {
    const series = buildDaySeries([{ _id: "2020-01-01", count: 99 }], 3, now);
    expect(series.every((p) => p.count === 0)).toBe(true);
  });
});

describe("seriesStart", () => {
  test("is the first day of the window, at midnight UTC", () => {
    expect(seriesStart(7, new Date("2026-10-02T15:30:00Z")).toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });
});

describe("maskEmail", () => {
  test("keeps the first letter and the domain", () => {
    expect(maskEmail("jane.doe@example.com")).toMatch(/^j\*{2,6}@example\.com$/);
  });

  test("handles junk", () => {
    expect(maskEmail(undefined)).toBe("");
    expect(maskEmail("no-at-sign")).toBe("");
  });
});

describe("fullName / clip", () => {
  test("joins first and last, and has a fallback for each kind of empty", () => {
    expect(fullName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
    expect(fullName({})).toBe("Unnamed"); // a user with no name parts
    expect(fullName(null)).toBe("Unknown"); // no user at all
  });

  test("clip leaves short text alone and ellipsises long text", () => {
    expect(clip("short", 10)).toBe("short");
    expect(clip("a".repeat(30), 10)).toHaveLength(10);
    expect(clip("a".repeat(30), 10).endsWith("…")).toBe(true);
  });
});
