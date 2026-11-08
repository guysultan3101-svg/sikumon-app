// חיבור לשרת של Clearly (Supabase): חשבונות, חברים, סיכומים, הודעות, התראות, פיד, משוב.
// הכתובת והמפתח הציבורי (publishable) אינם סודות – ההרשאות נאכפות בשרת (RLS): כל משתמש רואה רק את מה שמותר לו.

const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
export const URL_ = "https://islplhnlvaukixaglxof.supabase.co";
export const ANON = "sb_publishable_1fDG1GIaFERhcFPiRyx46g_38BIv8HZ";

let sb = null, me = null, session = null, recovering = false;
// הגיעו מהקישור "שכחתי סיסמה" במייל – צריך לבחור סיסמה חדשה
export const isRecovery = () => recovering;
export async function init() {
  if (sb) return sb;
  if (/type=recovery/.test(location.hash + location.search)) recovering = true;
  const { createClient } = await import(SDK);
  sb = createClient(URL_, ANON, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sikumon-auth" } });
  session = (await sb.auth.getSession()).data.session;
  sb.auth.onAuthStateChange((e, s) => { session = s; if (!s) me = null; if (e === "PASSWORD_RECOVERY") recovering = true; });
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
  if (/profiles_uni_email_key/i.test(m)) return "המייל של המוסד כבר רשום בחשבון אחר";
  if (/uni_email_check|profiles_uni_email/i.test(m)) return "המייל של המוסד צריך להיגמר ב-ac.il";
  if (/Password should be/i.test(m)) return "סיסמה של 8 תווים לפחות";
  if (/rate limit|too many/i.test(m)) return "יותר מדי ניסיונות. חכו דקה ונסו שוב";
  if (/Failed to fetch|NetworkError/i.test(m)) return "אין חיבור לאינטרנט";
  return m;
}
const ok = ({ data, error }) => { if (error) throw new Error(heb(error)); return data; };

// ---------- חשבון ----------
// השם פנוי? (גם לפני התחברות). השרת מחזיר רק כן/לא, וחוסם שמות שמתחזים לצוות
export async function usernameFree(u) {
  const { data, error } = await sb.rpc("username_available", { p_username: u });
  if (error) throw new Error("לא הצלחנו לבדוק את שם המשתמש. נסו שוב");
  return data === true;
}
// סיסמה שכבר דלפה ברשת? (Have I Been Pwned, בשיטת k-anonymity: רק 5 התווים הראשונים של
// ה-SHA-1 יוצאים מהמכשיר – הסיסמה עצמה לא נשלחת לאף אחד). אם השירות לא זמין – לא חוסמים.
export async function passwordLeaked(password) {
  try {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!res.ok) return false;
    const line = (await res.text()).split("\n").find((l) => l.startsWith(hex.slice(5)));
    return !!line && Number(line.split(":")[1]) > 0;
  } catch { return false; }
}
// כל בדיקות הסיסמה במקום אחד (הרשמה ושינוי סיסמה)
export async function checkPassword(password, confirm) {
  if (password.length < 8) throw new Error("סיסמה של 8 תווים לפחות");
  if (confirm !== undefined && confirm !== password) throw new Error("הסיסמאות לא זהות. הקלידו את אותה סיסמה בשתי התיבות");
  if (await passwordLeaked(password)) throw new Error("הסיסמה הזו כבר דלפה ברשת ומופיעה ברשימות של האקרים. בחרו סיסמה אחרת");
}
// הגרסה של תנאי השימוש ומדיניות הפרטיות שהמשתמש/ת מאשר/ת בהרשמה (לעדכן יחד עם התאריך בדפים המשפטיים)
export const TERMS_VERSION = "2026-11-04";
export async function signUp({ email, password, username, full_name, uni, degree, birthday, uni_email }) {
  // כבר מחובר/ת אבל הפרופיל לא נוצר (למשל האינטרנט נפל באמצע) – רק משלימים את הפרופיל
  if (!session) {
    const r = await sb.auth.signUp({ email, password });
    if (r.error) throw new Error(heb(r.error));
    if (!r.data.session) throw new Error("צריך לאשר את המייל (בדקו את תיבת הדואר) ואז להתחבר");
    session = r.data.session;
  }
  ok(await sb.from("profiles").insert({ id: session.user.id, username, full_name, uni, degree, birthday: birthday || null, uni_email: uni_email || null,
    // תיעוד ההסכמה לתנאים ולמדיניות (התיבה בטופס חובה ולא מסומנת מראש)
    terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }));
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
export async function changePassword(password, confirm) { await checkPassword(password, confirm); ok(await sb.auth.updateUser({ password })); recovering = false; }
export async function updateMe(fields) { ok(await sb.from("profiles").update(fields).eq("id", user().id)); return loadMe(); }
export async function deleteAccount() {
  const res = await fetch(`${URL_}/functions/v1/delete-account`, { method: "POST", headers: { Authorization: `Bearer ${token()}`, apikey: ANON } });
  if (!res.ok) throw new Error("המחיקה לא הצליחה. נסו שוב");
  await signOut();
}
// מעקב, משוב ודיווחים נשמרים באזור פרטי בשרת – רק דרך פונקציות (אין גישה ישירה לטבלאות)
export async function track(name) { if (user()) sb.rpc("track_event", { p_name: name.slice(0, 60) }).then(() => {}); }
export async function sendFeedback(data) { ok(await sb.rpc("send_feedback", { p_data: data })); }
export async function report({ target, post, reason }) { ok(await sb.rpc("report_content", { p_target: target || null, p_post: post || null, p_reason: reason || "" })); }
export async function touch() { if (user()) sb.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user().id).then(() => {}); }

// ---------- פרופילים וחברים ----------
// כל משתמש מחובר רואה רק את הבסיס; ביו, רשתות וקורסים – רק של חברים (השרת מחליט)
const PCOLS = "id, username, full_name, uni, degree";
async function withExtras(list) {
  if (!list.length) return list;
  const { data } = await sb.rpc("profile_extras", { p_ids: list.map((p) => p.id) });
  const ex = new Map((data || []).map((x) => [x.id, x]));
  return list.map((p) => ({ bio: "", ig: "", li: "", courses: [], ...p, ...(ex.get(p.id) || {}) }));
}
export async function findUser(username) { const p = ok(await sb.from("profiles").select(PCOLS).eq("username", username.toLowerCase()).maybeSingle()); return p ? (await withExtras([p]))[0] : null; }
export async function profiles(ids) { if (!ids.length) return []; return withExtras(ok(await sb.from("profiles").select(PCOLS).in("id", ids))); }
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
export async function block(id) { ok(await sb.from("blocks").upsert({ owner: user().id, blocked: id }, { ignoreDuplicates: true })); }
export async function unblock(id) { ok(await sb.from("blocks").delete().eq("owner", user().id).eq("blocked", id)); }

// ---------- סיכומים ----------
export async function summaries() { return ok(await sb.from("summaries").select("id, owner, course, title, md, quiz, source, source_ref, created_at").order("created_at", { ascending: false }).limit(500)); }
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
const AI_ERR = { limit: "הגעתם למכסה היומית של תמלול. מחר ממשיכים מאותו מקום 🙂", global_cap: "השרת עמוס היום. נסו שוב מחר", too_big: "החלק גדול מדי", not_found: "הקובץ פג תוקף – מעלים שוב", forbidden: "אין הרשאה לקובץ", provider: "ה-AI לא הצליח עכשיו. נסו שוב בעוד כמה דקות", auth: "צריך להתחבר מחדש", unsupported: "סוג קובץ לא נתמך", bad_input: "הבקשה לא תקינה. נסו שוב", origin: "הבקשה נחסמה" };
// הקלטות ארוכות: כל קטע עולה לאחסון זמני ופרטי (<משתמש>/...), והשרת מעביר אותו ל-Gemini ומוחק אותו מיד
export async function uploadRecording(name, blob, mime) {
  const path = `${user().id}/${name}`;
  const { error } = await sb.storage.from("recordings").upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw new Error(/exceed|too large|maximum|size/i.test(error.message) ? "הקטע גדול מדי להעלאה (עד 50MB)" : "ההעלאה נכשלה. בדקו את האינטרנט ונסו שוב");
  return path;
}
// שלב בתמלול: prepare (מהאחסון ל-Gemini) / window (תמלול חלון) / cleanup (מחיקה מ-Gemini)
export async function transcribeStep(body) {
  const res = await fetch(`${URL_}/functions/v1/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, apikey: ANON },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) return j;
  throw Object.assign(new Error(AI_ERR[j.error] || `תקלה (${res.status})`), { code: j.error });
}
// ---------- הגשת עבודות ----------
// מטלות שהתוסף במחשב מצא במודל (גם לבודקים שאין להם את המחשב של גיא)
export async function assignItems() { return ok(await sb.from("moodle_items").select("item_key, course, name, url, status, note, intro, files").eq("kind", "assign")); }
// חומרים לכל קורס + קישור לזום (מה שהמחבר בכרום הביא מהמודל)
export async function courseMaterials() { return ok(await sb.from("course_materials").select("course, zoom, items, updated_at")); }
// קישור חתום לקובץ מצורף של מטלה (אחסון פרטי) – תקף לשעה
export async function assignmentFileUrl(path) { const { data, error } = await sb.storage.from("assignment-files").createSignedUrl(path, 3600); if (error) throw error; return data.signedUrl; }
// מערכת שעות ולוח מבחנים שהמחבר הביא מהמידע האישי של המוסד (שורה אחת, רק שלי)
export async function uniSchedule() { return ok(await sb.from("uni_schedule").select("timetable, exams, source, updated_at").maybeSingle()); }
export async function submissionJobs() { return ok(await sb.from("submission_jobs").select("id, cmid, file_name, status, result, created_at, updated_at").order("created_at", { ascending: false }).limit(100)); }
const SUB_MIME = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zip: "application/zip", txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
// הקובץ עולה לאחסון זמני ופרטי, ונוצרת משימה שהמחבר במחשב יבצע במודל (ואז ימחק את הקובץ מכאן)
export async function submitAssignment({ cmid, name, course, file }) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = SUB_MIME[ext];
  if (!mime) throw new Error("אפשר להגיש PDF, וורד, מצגת, אקסל, ZIP, טקסט או תמונה");
  const path = `${user().id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("submissions").upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error(/exceed|size|large/i.test(error.message) ? "הקובץ גדול מדי (עד 25MB)" : "ההעלאה נכשלה. בדקו את האינטרנט ונסו שוב");
  try { ok(await sb.from("submission_jobs").insert({ cmid: Number(cmid), assign_name: name.slice(0, 300), course: (course || "").slice(0, 200), file_path: path, file_name: file.name.slice(0, 255) })); }
  catch (e) { await sb.storage.from("submissions").remove([path]).catch(() => {}); throw e; }
}
export async function cancelSubmission(id) { ok(await sb.from("submission_jobs").update({ status: "cancelled" }).eq("id", id).eq("status", "queued")); }

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
export async function sendMessage(recipient, body) {
  const r = ok(await sb.from("messages").insert({ sender: user().id, recipient, body }).select("id").single());
  // עד שתהיה אפליקציה עם התראות: מייל לנמען (השרת מחליט אם לשלוח – לא אם הוא מחובר עכשיו, ולא יותר מאחד בחצי שעה)
  if (r?.id) notifyEmail({ action: "message", message_id: r.id }).catch(() => {});
}
// מיילים ו-Early Access (פונקציית שרת)
export async function notifyEmail(body) {
  const { data, error } = await sb.functions.invoke("notify-email", { body });
  if (error) {
    let m = "תקלה"; try { m = (await error.context.json()).error || m; } catch { /* */ }
    throw new Error(m === "smtp_not_configured" ? "המיילים עוד לא מחוברים (צריך להוסיף את סיסמת Gmail בשרת)" : m === "forbidden" ? "אין הרשאה" : m === "smtp_login" ? "Gmail לא מקבל את הסיסמה. צריך סיסמת אפליקציה (16 תווים) של אותו חשבון ג'ימייל" : m === "resend_key" ? "מפתח Resend בשרת לא תקין – צריך ליצור מפתח חדש ב-Resend ולהדביק אותו שוב" : m === "resend_domain" ? "הדומיין clearlyapp.io עוד לא אומת ב-Resend (הרשומות ב-GoDaddy עוד לא נקלטו – לפעמים זה לוקח עד שעה)" : m);
  }
  return data;
}
export async function amAdmin() { const { data } = await sb.rpc("am_admin"); return !!data; }
export async function markRead(other) { ok(await sb.from("messages").update({ read_at: new Date().toISOString() }).eq("recipient", user().id).eq("sender", other).is("read_at", null)); }
export async function chatAccepts() { return ok(await sb.from("chat_accepts").select("other")); }
export async function acceptChat(other) { ok(await sb.from("chat_accepts").upsert({ owner: user().id, other }, { ignoreDuplicates: true })); }
export async function deleteChatFrom(other) { /* מחיקה = חסימה שקטה של השיחה אצלי */ ok(await sb.from("blocks").upsert({ owner: user().id, blocked: other }, { ignoreDuplicates: true })); }

// ---------- התראות ----------
export async function notifications() { return ok(await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)); }
export async function markNotifications(ids) { if (ids.length) ok(await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids)); }

// ---------- פספסתי שיעור ----------
export async function missed(course, lesson_date, audience = "friends", recipients = []) { ok(await sb.from("missed_requests").insert({ owner: user().id, course, lesson_date, audience, recipients })); }

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
export async function like(post, on) { ok(on ? await sb.from("post_likes").upsert({ post, user_id: user().id }, { ignoreDuplicates: true }) : await sb.from("post_likes").delete().eq("post", post).eq("user_id", user().id)); }
export async function saves() { return ok(await sb.from("post_saves").select("post")); }
export async function save(post, on) { ok(on ? await sb.from("post_saves").upsert({ post, user_id: user().id }, { ignoreDuplicates: true }) : await sb.from("post_saves").delete().eq("post", post).eq("user_id", user().id)); }
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
  const { data } = await sb.rpc("my_quota");
  return Object.fromEntries((data || []).map((r) => [r.kind, r.count]));
}
