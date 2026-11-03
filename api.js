// חיבור לשרת של סיכומון (Supabase): חשבונות, חברים, סיכומים, הודעות, התראות, פיד, משוב.
// הכתובת והמפתח הציבורי (anon) אינם סודות – ההרשאות נאכפות בשרת (RLS): כל משתמש רואה רק את מה שמותר לו.

const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
export const URL_ = "https://islplhnlvaukixaglxof.supabase.co";
export const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbHBsaG5sdmF1a2l4YWdseG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MzA2OTksImV4cCI6MjEwOTIwNjY5OX0.7-E0x9NmUT1ljh7usGOGQ99bWqiSfXFFP1w4qk_lXys";

let sb = null, me = null, session = null;
export async function init() {
  if (sb) return sb;
  const { createClient } = await import(SDK);
  sb = createClient(URL_, ANON, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sikumon-auth" } });
  session = (await sb.auth.getSession()).data.session;
  sb.auth.onAuthStateChange((_e, s) => { session = s; if (!s) me = null; });
  if (session) await loadMe();
  return sb;
}
export const client = () => sb;
export const user = () => session?.user || null;
export const profile = () => me;
export const token = () => session?.access_token || "";
async function loadMe() { const { data } = await sb.rpc("my_profile"); me = data?.[0] || null; return me; }

// שגיאות של השרת -> עברית
function heb(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return "המייל או הסיסמה לא נכונים";
  if (/already registered|already exists/i.test(m)) return "כבר יש חשבון עם המייל הזה. נסו להתחבר";
  if (/profiles_username_key|duplicate key.*username/i.test(m)) return "שם המשתמש תפוס. בחרו שם אחר";
  if (/Password should be/i.test(m)) return "סיסמה של 8 תווים לפחות";
  if (/rate limit|too many/i.test(m)) return "יותר מדי ניסיונות. חכו דקה ונסו שוב";
  if (/Failed to fetch|NetworkError/i.test(m)) return "אין חיבור לאינטרנט";
  return m;
}
const ok = ({ data, error }) => { if (error) throw new Error(heb(error)); return data; };

// ---------- חשבון ----------
export async function usernameFree(u) {
  const { data } = await sb.from("profiles").select("id").eq("username", u).maybeSingle();
  return !data;
}
export async function signUp({ email, password, username, full_name, uni, degree, birthday }) {
  // כבר מחובר/ת אבל הפרופיל לא נוצר (למשל האינטרנט נפל באמצע) – רק משלימים את הפרופיל
  if (!session) {
    const r = await sb.auth.signUp({ email, password });
    if (r.error) throw new Error(heb(r.error));
    if (!r.data.session) throw new Error("צריך לאשר את המייל (בדקו את תיבת הדואר) ואז להתחבר");
    session = r.data.session;
  }
  ok(await sb.from("profiles").insert({ id: session.user.id, username, full_name, uni, degree, birthday: birthday || null }));
  return loadMe();
}
export async function signIn(email, password) {
  const r = await sb.auth.signInWithPassword({ email, password });
  if (r.error) throw new Error(heb(r.error));
  session = r.data.session;
  return loadMe();
}
export async function signOut() { await sb.auth.signOut(); session = null; me = null; }
export async function resetPassword(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); }
export async function changePassword(password) { if (password.length < 8) throw new Error("סיסמה של 8 תווים לפחות"); ok(await sb.auth.updateUser({ password })); }
export async function updateMe(fields) { ok(await sb.from("profiles").update(fields).eq("id", user().id)); return loadMe(); }
export async function deleteAccount() {
  const res = await fetch(`${URL_}/functions/v1/delete-account`, { method: "POST", headers: { Authorization: `Bearer ${token()}`, apikey: ANON } });
  if (!res.ok) throw new Error("המחיקה לא הצליחה. נסו שוב");
  await signOut();
}
export async function track(name) { if (user()) sb.from("events").insert({ name: name.slice(0, 60) }).then(() => {}); }
export async function sendFeedback(data) { ok(await sb.from("feedback").insert({ data })); }
export async function report({ target, post, reason }) { ok(await sb.from("reports").insert({ target: target || null, post: post || null, reason: reason || "" })); }
export async function touch() { if (user()) sb.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user().id).then(() => {}); }

// ---------- פרופילים וחברים ----------
const PCOLS = "id, username, full_name, uni, degree, bio, ig, li, courses";
export async function findUser(username) { return ok(await sb.from("profiles").select(PCOLS).eq("username", username.toLowerCase()).maybeSingle()); }
export async function profiles(ids) { if (!ids.length) return []; return ok(await sb.from("profiles").select(PCOLS).in("id", ids)); }
export async function friendships() { return ok(await sb.from("friendships").select("*")); }
export async function requestFriend(id) { ok(await sb.from("friendships").insert({ requester: user().id, addressee: id })); }
export async function acceptFriend(fid) { ok(await sb.from("friendships").update({ status: "accepted" }).eq("id", fid)); }
export async function removeFriend(fid) { ok(await sb.from("friendships").delete().eq("id", fid)); }
export async function birthdays() { return ok(await sb.rpc("friends_birthdays")); }
// אותה כיתה: מה אני משתף עם מי, ומה משתפים איתי
export async function shares() { return ok(await sb.from("course_shares").select("*")); }
export async function share(friend, course) { ok(await sb.from("course_shares").upsert({ owner: user().id, friend, course }, { onConflict: "owner,friend,course", ignoreDuplicates: true })); }
export async function unshare(friend, course) { ok(await sb.from("course_shares").delete().eq("owner", user().id).eq("friend", friend).eq("course", course)); }
export async function blocks() { return ok(await sb.from("blocks").select("*")); }
export async function block(id) { ok(await sb.from("blocks").upsert({ owner: user().id, blocked: id })); }
export async function unblock(id) { ok(await sb.from("blocks").delete().eq("owner", user().id).eq("blocked", id)); }

// ---------- סיכומים ----------
export async function summaries() { return ok(await sb.from("summaries").select("id, owner, course, title, md, quiz, source, created_at").order("created_at", { ascending: false }).limit(500)); }
export async function deleteSummary(id) { ok(await sb.from("summaries").delete().eq("id", id)); }
// קובץ -> סיכום אישי (השרת מסכם לפי השאלון)
export async function summarizeFile(file, course) {
  if (file.size > 15 * 1024 * 1024) throw new Error("הקובץ גדול מדי (עד 15MB)");
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const res = await fetch(`${URL_}/functions/v1/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, apikey: ANON },
    body: JSON.stringify({ filename: file.name, mime: file.type, data: btoa(bin), course, source: "upload" }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) return j;
  const msg = { limit: `הגעת ל-${j.limit || 10} סיכומים להיום. מחר יש עוד 🙂`, global_cap: "השרת עמוס היום. נסו שוב מחר", too_big: "הקובץ גדול מדי (עד 15MB)", unsupported: "אפשר להעלות PDF, מצגת (pptx), וורד (docx), תמונה או טקסט", provider: "ה-AI לא הצליח לסכם עכשיו. נסו שוב בעוד כמה דקות", auth: "צריך להתחבר מחדש" }[j.error];
  throw new Error(msg || `תקלה (${res.status})`);
}

// ---------- תמלול הקלטות ----------
const b64 = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(bin); };
const AI_ERR = { limit: "הגעתם למכסה היומית. מחר אפשר להמשיך 🙂", global_cap: "השרת עמוס היום. נסו שוב מחר", too_big: "החלק גדול מדי", provider: "ה-AI לא הצליח עכשיו. נסו שוב בעוד כמה דקות", auth: "צריך להתחבר מחדש", unsupported: "סוג קובץ לא נתמך" };
// חלק אחד של הקלטה (עד ~12 דקות) -> טקסט
export async function transcribePart(blob, mime, { skipFirst = false, startMin = 0 } = {}) {
  const res = await fetch(`${URL_}/functions/v1/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, apikey: ANON },
    body: JSON.stringify({ data: await b64(blob), mime, skipFirst, startMin }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) return j.text || "";
  throw Object.assign(new Error(AI_ERR[j.error] || `תקלה (${res.status})`), { code: j.error });
}
// טקסט (למשל תמלול) -> סיכום אישי + מבחן, כמו מצגת
export async function summarizeText(text, title, course, ref) {
  const res = await fetch(`${URL_}/functions/v1/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, apikey: ANON },
    body: JSON.stringify({ text, filename: title, course, source: "upload", source_ref: ref }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) return j;
  throw Object.assign(new Error(AI_ERR[j.error] || `תקלה (${res.status})`), { code: j.error });
}

// ---------- הודעות ----------
export async function messages() { return ok(await sb.from("messages").select("*").order("created_at", { ascending: true }).limit(1000)); }
export async function sendMessage(recipient, body) { ok(await sb.from("messages").insert({ sender: user().id, recipient, body })); }
export async function markRead(other) { ok(await sb.from("messages").update({ read_at: new Date().toISOString() }).eq("recipient", user().id).eq("sender", other).is("read_at", null)); }
export async function chatAccepts() { return ok(await sb.from("chat_accepts").select("other")); }
export async function acceptChat(other) { ok(await sb.from("chat_accepts").upsert({ owner: user().id, other })); }
export async function deleteChatFrom(other) { /* מחיקה = חסימה שקטה של השיחה אצלי */ ok(await sb.from("blocks").upsert({ owner: user().id, blocked: other })); }

// ---------- התראות ----------
export async function notifications() { return ok(await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)); }
export async function markNotifications(ids) { if (ids.length) ok(await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids)); }

// ---------- פספסתי שיעור ----------
export async function missed(course, lesson_date) { ok(await sb.from("missed_requests").insert({ owner: user().id, course, lesson_date })); }

// ---------- פיד ----------
export async function posts() { return ok(await sb.from("posts").select("*").order("created_at", { ascending: false }).limit(100)); }
export async function addPost(p) { ok(await sb.from("posts").insert({ ...p, author: user().id })); }
export async function deletePost(id, media = []) {
  if (media.length) await sb.storage.from("post-media").remove(media.map((m) => m.path)).catch(() => {});
  ok(await sb.from("posts").delete().eq("id", id));
}
// קבצים של פוסט: תמונות מוקטנות לפני ההעלאה (חוסך מקום ואינטרנט), קבצים אחרים כמו שהם (עד 10MB)
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp|heic)/.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(im.width, im.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}
export async function preparePostFiles(files) {
  const out = [];
  for (const f of files) {
    const g = await shrinkImage(f);
    if (g.size > 10 * 1024 * 1024) throw new Error(`"${f.name}" גדול מדי (עד 10MB לקובץ)`);
    out.push(g);
  }
  return out;
}
// פוסט עם קבצים: יוצרים את הפוסט, ואז מעלים את הקבצים לתיקייה שלו
export async function addPostWithMedia(p, files) {
  const id = crypto.randomUUID();
  const media = files.map((f, i) => ({ path: `${id}/${i}-${f.name.replace(/[^\w.\-א-ת]+/g, "_").slice(-80)}`, name: f.name, type: f.type, size: f.size }));
  ok(await sb.from("posts").insert({ ...p, id, media, author: user().id }));
  for (const [i, f] of files.entries()) {
    const { error } = await sb.storage.from("post-media").upload(media[i].path, f, { contentType: f.type || "application/octet-stream" });
    if (error) throw new Error("העלאת " + f.name + " נכשלה");
  }
}
// קישורים זמניים (שעה) לתמונות ולקבצים של פוסטים שמותר לי לראות
export async function mediaUrls(paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from("post-media").createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
export async function likes(ids) { if (!ids.length) return []; return ok(await sb.from("post_likes").select("post, user_id").in("post", ids)); }
export async function like(post, on) { ok(on ? await sb.from("post_likes").upsert({ post, user_id: user().id }) : await sb.from("post_likes").delete().eq("post", post).eq("user_id", user().id)); }
export async function saves() { return ok(await sb.from("post_saves").select("post")); }
export async function save(post, on) { ok(on ? await sb.from("post_saves").upsert({ post, user_id: user().id }) : await sb.from("post_saves").delete().eq("post", post).eq("user_id", user().id)); }
export async function comments(ids) { if (!ids.length) return []; return ok(await sb.from("post_comments").select("*").in("post", ids).order("created_at")); }
export async function comment(post, body) { ok(await sb.from("post_comments").insert({ post, author: user().id, body })); }

// ---------- AI (העוזר המובנה) ----------
export async function askStream(payload, signal) {
  return fetch(`${URL_}/functions/v1/ask`, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, apikey: ANON },
    body: JSON.stringify(payload),
  });
}
export async function quotaToday() {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const { data } = await sb.from("ai_usage").select("kind, count").eq("day", day);
  return Object.fromEntries((data || []).map((r) => [r.kind, r.count]));
}
