/* Server-backed API adapters. Credentials stay in HttpOnly cookies;
   recovery tokens remain in memory only. Public profile responses exclude
   email addresses, legal surnames and dates of birth. */

import api, { API_ORIGIN } from "../api";

/* VerificationModal calls sendVerificationCode()/verifyCode() with no
   arguments (see components/VerificationModal.jsx), so this remembers which
   account submitSignup() just created and is currently mid-verification —
   see the EMAIL VERIFICATION section below for where it's read. */
let pendingVerificationEmail = "";

/**
 * Turns a path the backend stored (e.g. "/uploads/3f9a...c2.jpg") into a
 * loadable <img src>. Every profile photo and avatar path is relative like
 * this — nothing pre-builds the full URL, so this is the one place that
 * decides how they're reached. Returns null straight through, since "no
 * avatar yet" (null) should stay falsy rather than become a broken image src.
 */
export function toPhotoUrl(path) {
  return path ? `${API_ORIGIN}${path}` : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   HOME / LANDING PAGE
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Headline numbers shown beside the bar chart on the landing page.
 * @route  GET /api/stats
 * @returns {{ label: string, value: number }[]}  value drives the bar height
 */
export async function getLandingStats() {
  return (await api.get("/stats")).data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SIGNUP  (the 3-step stamp form)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Creates the account. The server hashes the password and creates the
 * account unverified — pages/Signup.jsx opens VerificationModal right after
 * this resolves, and log-in refuses anyone who hasn't gotten through it (see
 * loginUser below).
 * @route  POST /api/signup
 * @param  {{ firstName, middleName, lastName, email, password, birthdate,
 *            gender, bio, photos: File[], tags: string[] }} signup
 * @returns {{ userId: string }}
 * Sent as multipart/form-data whenever there's at least one photo (the
 * normal case — PhotosForm requires one by default), so the files can ride
 * along with the rest of the form in the same request; otherwise it's sent
 * as plain JSON, same as before photos existed. Either way `tags` travels as
 * a JSON-encoded string on the multipart path, since every multipart field
 * is text — the backend's parseListField (utils/tasteOptions.js) reads
 * either form.
 */
export async function submitSignup(signup) {
  const { photos = [], tags = [], ...fields } = signup;
  pendingVerificationEmail = signup.email.trim().toLowerCase();

  if (photos.length === 0) {
    const { data } = await api.post("/signup", { ...fields, tags });
    return data;
  }

  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, value);
  });
  form.append("tags", JSON.stringify(tags));
  photos.forEach((file) => form.append("photos", file));

  const { data } = await api.post("/signup", form);
  return data;
}

/**
 * The chip lists shown on sign-up step 3 and the profile "Your taste" tab —
 * personality chips and "looking for" chips are separate lists, each with
 * its own pick limit. Both sides are validated against these same lists
 * server-side (backend/utils/tasteOptions.js), so a chip can never appear
 * here and be rejected on save, or vice versa.
 * @route  GET /api/tags
 * @returns {{ personality: string[], lookingFor: string[],
 *             limits: { minPersonality: number, maxPersonality: number, maxLookingFor: number } }}
 */
export async function getTasteOptions() {
  const { data } = await api.get("/tags");
  return data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   EMAIL VERIFICATION  (components/VerificationModal.jsx — shown right after
   signup finishes, and it's mandatory: see the note above <VerificationModal>
   in pages/Signup.jsx for what that means)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Emails a one-time code to the account that just signed up. The modal calls
 * this itself the moment it opens, and again if the person hits "Send a new
 * code" after the timer runs out.
 * @route  POST /api/verify/send
 * @returns {{ expiresIn: number }}  seconds the code stays valid — what the
 *          modal's countdown starts from
 */
export async function sendVerificationCode(email = pendingVerificationEmail) {
  const { data } = await api.post("/verify/send", { email });
  return data;
}

/**
 * Checks the code the person typed into the modal.
 * @route  POST /api/verify/confirm
 * @param  {string} code
 * @returns {{ verified: boolean, userId?: string, role?: string }}
 */
export async function verifyCode(code, email = pendingVerificationEmail) {
  const { data } = await api.post("/verify/confirm", { code, email });
  return data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   LOG-IN  (pages/Login.jsx)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * @route  POST /api/auth/login
 * @param  {{ email: string, password: string }} credentials
 * @returns {{ userId: string, role: "user" | "moderator" | "admin" }}
 *          `role` decides where the page sends the person next:
 *          user → /discover, moderator → /moderator, admin → /admin.
 * The account has to be verified first — an otherwise-correct email/password
 * gets a 403, which LoginForm shows as "Verify your email before logging in"
 * rather than the generic wrong-password message.
 */
export async function loginUser({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PASSWORD RECOVERY  (pages/Login.jsx — "Forgot password?")

   Recovery emails a short-lived code, exchanges it for a one-time reset
   credential held only in memory, and revokes sessions when the reset saves.

     LOG-IN view ──"Forgot password?"──▶ RECOVERY view ──▶ PASSWORD view ──▶ LOG-IN
     loginUser       requestRecoveryCode   verifyRecoveryCode   resetPassword
   ───────────────────────────────────────────────────────────────────────── */

/**
 * @route  POST /api/auth/recovery/request
 * @param  {string} email
 * @returns {{ expiresInSeconds: number }}  the "00:00" countdown starts from this
 * 🔌 Answer 200 even when the email isn't registered — the page must not
 *    reveal who has an account.
 */
export async function requestRecoveryCode(email) {
  return (await api.post("/auth/recovery/request", { email })).data;
}
export async function verifyRecoveryCode({ email, code }) {
  return (await api.post("/auth/recovery/verify", { email, code })).data;
}
export async function resetPassword({ resetToken, newPassword }) {
  return (await api.post("/auth/recovery/reset", { resetToken, newPassword })).data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   DISCOVER / HOME FEED  (the card grid you browse after logging in)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * The grid of browsable profiles. Search and filters are sent as query
 * params so the backend filters before cursor pagination.
 * @route  GET /api/discover?query=&gender=&minAge=&maxAge=&cursor=
 * @param  {{ query?: string, gender?: string, maxDistance?: number,
 *            minAge?: number, maxAge?: number }} params
 * @returns {{ id, name, age, distanceMi, gender, photoUrl, bio }[]}
 */
export async function getDiscoverProfiles(params = {}) {
  const { data } = await api.get("/discover", { params });
  return { ...data, profiles: data.profiles.map((profile) => ({ ...profile, photoUrl: toPhotoUrl(profile.photoPath) })) };
}
export async function likeProfile(profileId) {
  return (await api.post("/discover/like", { profileId })).data;
}
export async function passProfile(profileId) {
  return (await api.post("/discover/pass", { profileId })).data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROFILE PAGE
   ───────────────────────────────────────────────────────────────────────── */

/** Whole years between an ISO date-of-birth and today, UTC-based to match the backend. */
function calculateAgeFromISO(dateOfBirth) {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/** ISO date -> "MM/DD/YY", matching the mock's format. */
function formatBirthdate(dateOfBirth) {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const mm = String(dob.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dob.getUTCDate()).padStart(2, "0");
  const yy = String(dob.getUTCFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/**
 * ISO date/datetime -> "YYYY-MM-DD", the one format <input type="date">
 * accepts as a value. Kept separate from formatBirthdate's "MM/DD/YY" (which
 * is for reading, not editing) so EditProfileModal always has something it
 * can drop straight into its date field.
 */
function toDateInputValue(dateOfBirth) {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const mm = String(dob.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dob.getUTCDate()).padStart(2, "0");
  return `${dob.getUTCFullYear()}-${mm}-${dd}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO date -> "Sep 2026", matching the mock's format. */
function formatJoinDate(dateString) {
  if (!dateString) return undefined;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fullName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined;
}

function formatAddress(location) {
  return [location?.city, location?.country].filter(Boolean).join(", ") || undefined;
}

/**
 * GET /api/profile/me returns `{ user, profile }` (backend/controllers/
 * controller.js's getMe) — this reshapes that into what the profile page's
 * components expect, so nothing downstream has to know about the backend's
 * document layout. `ratings`, `lastDate` and `reviews` have no backing route
 * yet (Rating/Match exist as models, nothing serves them), so they come back
 * empty/undefined and render as "—" or an empty state rather than guessed data.
 *
 * Alongside the display-formatted fields (`address`, `birthdate`, `age`) this
 * also exposes the raw, editable values EditProfileModal needs to prefill its
 * form — `displayName`, `gender`, `city`, `country` and `rawBirthdate`. All
 * five live on the Profile document, never the User account.
 */
function mapProfileResponse({ user, profile, reviews = [] } = {}) {
  return {
    name: fullName(user),
    // Profile.profileName — a display name distinct from the account's
    // legal name. Undefined until someone sets one via EditProfileModal.
    displayName: profile?.profileName || undefined,
    bio: profile?.bio,
    address: formatAddress(profile?.location),
    age: calculateAgeFromISO(profile?.dateOfBirth),
    birthdate: formatBirthdate(profile?.dateOfBirth),
    gender: profile?.gender,
    city: profile?.location?.city,
    country: profile?.location?.country,
    // Raw form value for EditProfileModal's <input type="date">; the
    // formatted `birthdate` above stays what the read-only meta row shows.
    rawBirthdate: toDateInputValue(profile?.dateOfBirth),
    ratings: undefined,
    dateJoined: formatJoinDate(user?.createdAt),
    lastDate: undefined,
    avatarPath: profile?.avatar ?? null,
    tags: profile?.interests ?? [],
    lookingFor: profile?.lookingFor?.intents ?? [],
    photoPaths: profile?.photos ?? [],
    reviews,
  };
}

/**
 * Everything the profile page needs in one request.
 * @route  GET /api/profile/:userId   (only "me" actually resolves today —
 *         the backend route is the literal /api/profile/me, not a :userId
 *         param yet; see backend/routes/routes.js)
 * @returns {{ name, displayName, bio, address, age, birthdate, rawBirthdate,
 *             gender, city, country, ratings, dateJoined, lastDate,
 *             avatarPath, tags, lookingFor, photoPaths, reviews }}
 *          avatarPath/photoPaths are raw backend paths ("/uploads/x.jpg");
 *          pass them through toPhotoUrl() to get something an <img> can load.
 */
export async function getProfile(userId = "me") {
  const { data } = await api.get(`/profile/${userId}`);
  return mapProfileResponse(data);
}

/**
 * Saves the "Your taste" personality chips after the user hits ✔. Replaces
 * the full list, not a diff.
 * @route  PUT /api/profile/tags
 * @param  {string[]} tags
 * @returns {string[]}  the saved list, echoed back
 */
export async function saveProfileTags(tags) {
  const { data } = await api.put("/profile/tags", { tags });
  return data.tags;
}

/**
 * Saves the "Looking for" chips — kept as a separate save from personality
 * tags, so editing one never touches the other.
 * @route  PUT /api/profile/looking-for
 * @param  {string[]} lookingFor
 * @returns {string[]}  the saved list, echoed back
 */
export async function saveLookingFor(lookingFor) {
  const { data } = await api.put("/profile/looking-for", { lookingFor });
  return data.lookingFor;
}

/**
 * Saves the fields from the profile page's "Edit profile" pop-up
 * (components/profile/EditProfileModal.jsx): display name, bio, gender,
 * birthdate, and location. Every one of these lives on the Profile
 * document — never the User account, so this route can't touch email or
 * password (see the pop-up's own scope note for why that split matters).
 * @route  PUT /api/profile/details
 * @param  {{ displayName?: string, bio?: string, gender: string,
 *            birthdate: string, city?: string, country?: string }} updates
 *          `birthdate` is "YYYY-MM-DD", straight from the date input.
 * @returns {{ displayName, bio, gender, city, country, address, age,
 *             birthdate, rawBirthdate }}
 *          Shaped to match mapProfileResponse's own field names, so the
 *          caller can spread this straight over the existing profile state
 *          — see pages/Profile.jsx.
 */
export async function updateProfileDetails(updates) {
  const { data } = await api.put("/profile/details", updates);
  const profile = data.profile;
  return {
    displayName: profile.profileName || undefined, bio: profile.bio, gender: profile.gender,
    city: profile.location?.city, country: profile.location?.country,
    address: formatAddress(profile.location), age: calculateAgeFromISO(profile.dateOfBirth),
    birthdate: formatBirthdate(profile.dateOfBirth), rawBirthdate: toDateInputValue(profile.dateOfBirth),
  };
}

/**
 * Uploads new photos from the "Your photos" tab. If the account had no
 * photos before this call, the first one uploaded also becomes the avatar
 * (see backend/controllers/profileController.js) — `avatarPath` in the
 * response reflects that.
 * @route  POST /api/profile/photos   (multipart, field name "photos")
 * @param  {File[]} files
 * @returns {{ photoPaths: string[], avatarPath: string|null }}
 */
export async function uploadProfilePhotos(files) {
  const form = new FormData();
  files.forEach((file) => form.append("photos", file));
  const { data } = await api.post("/profile/photos", form, { timeout: 180000 });
  return { photoPaths: data.photos, avatarPath: data.avatar };
}

/**
 * Deletes one photo. `photoId` is the filename portion of its path (e.g.
 * "3f9a1c...b2.jpg" out of "/uploads/3f9a1c...b2.jpg"). The backend refuses
 * to delete the current avatar or the last photo left, and answers 400 with
 * a message either way — surface that message rather than a generic one.
 * @route  DELETE /api/profile/photos/:filename
 * @param  {string} photoId
 * @returns {string[]}  the remaining photo paths
 */
export async function deleteProfilePhoto(photoId) {
  const { data } = await api.delete(`/profile/photos/${photoId}`);
  return data.photos;
}

/**
 * Makes an existing photo the profile picture. `photoPath` must be one of
 * the account's own photo paths — the backend rejects anything else.
 * @route  PUT /api/profile/avatar
 * @param  {string} photoPath
 * @returns {string}  the new avatar path, echoed back
 */
export async function setProfileAvatar(photoPath) {
  const { data } = await api.put("/profile/avatar", { photo: photoPath });
  return data.avatar;
}

/* ─────────────────────────────────────────────────────────────────────────────
   MATCH HISTORY  (components/MatchHistory.jsx — the clock in the AppNav header)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Backend match-history response -> what components/MatchHistory.jsx draws.
 * The backend sends photo PATHS ("/uploads/x.jpg", or null) like it does for
 * every other photo, and they become loadable URLs here via toPhotoUrl(), so
 * the component only ever deals with `avatarUrl`. The mock goes through this
 * too, which means swapping in the real call changes nothing downstream.
 */
function mapMatchHistoryResponse({ me, matches = [], nextCursor = null } = {}) {
  return {
    me: me ? { name: me.name, avatarUrl: toPhotoUrl(me.avatarPath) } : null,
    matches: matches.map((m) => ({
      id: m.id,
      matchedAt: m.matchedAt,
      reviewed: Boolean(m.reviewed),
      partner: {
        id: m.partner?.id,
        name: m.partner?.name,
        avatarUrl: toPhotoUrl(m.partner?.avatarPath),
      },
    })),
    nextCursor,
  };
}

/**
 * The signed-in user's matches, newest first, one page at a time. Feeds the
 * match-history dropdown in the header (components/MatchHistory.jsx), which
 * only asks for it when the clock is opened — not on page load.
 * @route  GET /api/matches/history?cursor=&limit=
 * @param  {{ cursor?: string | null, limit?: number }} params
 *         `cursor` is whatever the previous page returned as nextCursor;
 *         leave it out for the first page.
 * @returns {{
 *   me: { name: string, avatarUrl: string | null },
 *   matches: {
 *     id: string,                 Match _id
 *     matchedAt: string,          Match.createdAt, ISO
 *     reviewed: boolean,          true if this user already rated that person
 *     partner: { id: string, name: string, avatarUrl: string | null },
 *   }[],
 *   nextCursor: string | null,    null on the last page
 * }}
 * The server sends the same
 * shape with `avatarPath` (a raw "/uploads/..." path) in place of each
 * `avatarUrl` — mapMatchHistoryResponse above converts it. Suggested query:
 * Match.find({ $or: [{ user1: me }, { user2: me }], status: "active" }) sorted
 * by createdAt desc, the other user's Profile.profileName (falling back to
 * their first name) and Profile.avatar for `partner`.
 * ⚠️ Work out `reviewed` from Rating.exists({ reviewerId: me, reviewedUserId:
 * partner }), NOT from matchId: Rating has a unique index on that pair, so a
 * rematched pair could otherwise show a REVIEW button that can never save.
 */
export async function getMatchHistory({ cursor = null, limit = 8 } = {}) {
  const { data } = await api.get("/matches/history", { params: { cursor, limit } });
  return mapMatchHistoryResponse(data);
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN / MODERATOR DASHBOARD
   ───────────────────────────────────────────────────────────────────────── */

/**
 * The live "ACTIVE: n" counter in the dashboard header.
 * Swap for a websocket later if the team wants it to tick in real time.
 * @route  GET /api/admin/active-count
 * @returns {{ activeCount: number }}
 */
export async function getActiveCount() {
  return (await api.get("/admin/overview")).data;
}

export async function getAdminSection() {
  throw new Error("Use the specific admin API for this section.");
}
