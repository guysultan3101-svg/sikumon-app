// המחבר של Clearly – הלוגיקה: התחברות ל-Clearly, קריאת הקורסים מהמודל (עם ההתחברות הרגילה של הסטודנט
// בכרום), איתור קבצים חדשים, ושליחתם לסיכום אישי בשרת. לא רואים ולא שומרים את הסיסמה למודל.
import { syncPortal, PORTALS } from "./portal.js";
import { planCourse } from "./classify.js";
import { flattenMonthly, activityEvents, isSubmitted, decideSubmitted, dueIso, cleanName } from "./activities.js";
export const SB = "https://islplhnlvaukixaglxof.supabase.co";
export const ANON = "sb_publishable_1fDG1GIaFERhcFPiRyx46g_38BIv8HZ";
export { MOODLES } from "./institutions.js";
// הכתובת של המודל עצמו מתוך כל כתובת שמודבקת. יש מוסדות שהמודל שלהם בתת-תיקייה
// (בבן-גוריון: moodle.bgu.ac.il/moodle), אז שומרים את הנתיב עד החלק שהוא כבר דף בתוך המודל.
export function moodleRoot(input) {
  const u = new URL(input);
  const cut = u.pathname.search(/\/(my|local|course|mod|login|user|calendar|admin|blocks|grade|message|lib|theme|auth|pluginfile\.php|index\.php)(\/|$|\?)/);
  const path = (cut >= 0 ? u.pathname.slice(0, cut) : u.pathname).replace(/\/+$/, "");
  return u.origin + path;
}
const PER_RUN_MAX = 25;   // בכל בדיקה אוטומטית – עד 15 קבצים (המכסה היומית בשרת מגבילה בנוסף)
const MANUAL_MAX = 50;     // כשלוחצים "בדיקה עכשיו"
// "קורסים" שהם בעצם לומדות והדרכות של המוסד – לא מסכמים אותם
const NOT_COURSE = /הטרדה|harassment|לומדה|הכרת הספרייה|הדרכה לקראת|instructions for|בטיחות ב|safety/i;
const OK_EXT = /\.(pdf|pptx|docx)$/i;
const OFFICE_EXT = /\.(pptx|docx)$/i;

const get = (k) => chrome.storage.local.get(k).then((o) => o[k]);
const set = (o) => chrome.storage.local.set(o);
export async function status(patch) { const s = { ...(await get("status")), ...patch, at: new Date().toISOString() }; await set({ status: s }); return s; }

// ---------- התחברות ל-Clearly ----------
// התשובות של השרת שאומרות שההתחברות השמורה כבר לא תקפה (ולא סתם תקלה)
const DEAD_SESSION = /^(refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|validation_failed|invalid_grant)$/;
async function authCall(grant, body) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=${grant}`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  // ההתחברות השמורה כבר לא בתוקף (למשל אחרי שינוי סיסמה או "יציאה מכל המכשירים"): מתנתקים לבד ומבקשים להתחבר שוב.
  // רק כשהשרת אומר במפורש שההתחברות מתה – לא ב"יותר מדי בקשות" (429), לא בחסימה של רשת ולא בתקלה זמנית.
  // שומרים את המודל ואת רשימת הקבצים שכבר טופלו – רק ההתחברות ל-Clearly נמחקת.
  if (!r.ok && grant === "refresh_token" && DEAD_SESSION.test(String(j.error_code || j.code || j.error || ""))) {
    // מרוץ: חלק אחר של התוסף (למשל החלון) חידש באותו רגע ושמר התחברות חדשה – אז לא מתנתקים, ממשיכים איתה
    const old = await get("auth");
    if (old?.refresh && old.refresh !== body.refresh_token) return old;
    if (old?.user && !(await get("seenOwner"))) await set({ seenOwner: old.user });
    await chrome.storage.local.remove("auth");
    await status({ state: "", error: "", relogin: "החיבור ל-Clearly נותק (למשל אחרי שינוי סיסמה). התחברו שוב עם המייל והסיסמה של Clearly." });
    throw new Error("צריך להתחבר שוב ל-Clearly (לחצו על סמל התוסף)");
  }
  if (!r.ok) throw new Error(/Invalid login/i.test(j.error_description || j.msg || "") ? "המייל או הסיסמה לא נכונים" : "ההתחברות ל-Clearly נכשלה");
  const auth = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000, user: j.user.id, email: j.user.email };
  await set({ auth });
  if (grant === "password") {
    await status({ relogin: "", error: "" });   // התחברו שוב – מנקים את ההודעה
    // רשימת הקבצים שכבר טופלו שייכת לחשבון. אותו חשבון – שומרים (לא מסכמים שוב). חשבון אחר – מתחילים מאפס
    const owner = await get("seenOwner");
    if (owner && owner !== auth.user) await chrome.storage.local.remove(["seen", "backlogLeft"]);
    await set({ seenOwner: auth.user });
  }
  return auth;
}
export const login = (email, password) => authCall("password", { email, password });
// התנתקות: רק ההתחברות. הרשימה של מה שכבר טופל נשארת, כדי שהתחברות מחדש לא תסכם שוב (נמחקת רק במעבר לחשבון אחר)
export async function logout() {
  const a = await get("auth"); if (a?.user && !(await get("seenOwner"))) await set({ seenOwner: a.user });
  await chrome.storage.local.remove(["auth", "status"]);
}
// חידוש אחד בכל פעם: אם הבדיקה של המודל ובדיקת ההגשות מחדשות יחד, שתיהן מחכות לאותו חידוש
// (אחרת השנייה שולחת מפתח שכבר הוחלף, והשרת מנתק את החיבור)
let refreshing = null;
async function token(force = false) {
  let a = await get("auth"); if (!a) throw new Error("צריך להתחבר ל-Clearly (לחצו על סמל התוסף)");
  if (force || Date.now() > a.exp) {
    refreshing ||= authCall("refresh_token", { refresh_token: a.refresh }).finally(() => { refreshing = null; });
    a = await refreshing;
  }
  return a;
}

// ---------- "הדף שלי לא נתמך": שליחת דוגמה של הדף הפתוח למפתח ----------
// המשתמש לוחץ ומאשר בעצמו. נשלח רק הדף הפתוח עכשיו (אתר .ac.il), בלי סקריפטים, שדות סיסמה ושדות נסתרים.
// כך אפשר לבנות תמיכה (למשל במערכת שעות) למוסד חדש בלי להתחבר לחשבון של אף אחד.
export async function sendPageSample(note = "") {
  const a = await token();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https:\/\/[^/]*\.ac\.il\//.test(tab.url)) throw new Error("קודם פותחים את הדף של המוסד (כתובת שנגמרת ב-ac.il), ואז לוחצים שוב");
  const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => {
    const c = document.documentElement.cloneNode(true);
    c.querySelectorAll("script,style,noscript,link,input[type=hidden],input[type=password],svg,img").forEach((n) => n.remove());
    c.querySelectorAll("input,textarea,select").forEach((n) => { n.removeAttribute("value"); });
    return { url: location.origin + location.pathname, title: document.title, html: c.outerHTML };
  } });
  const parts = frames.map((f) => f.result).filter((x) => x?.html && x.html.length > 200);
  if (!parts.length) throw new Error("הדף ריק. נסו שוב אחרי שהוא נטען עד הסוף");
  const html = parts.map((p, i) => `<!-- FRAME ${i} ${p.url} -->\n${p.html}`).join("\n").replace(/\s{2,}/g, " ");
  if (html.length > 1.4e6) throw new Error("הדף גדול מדי לשליחה");
  const r = await fetch(`${SB}/rest/v1/page_samples`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${a.access}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ url: parts[0].url.slice(0, 2000), title: (parts[0].title || "").slice(0, 300), html, note: String(note).slice(0, 300) }) });
  if (!r.ok) throw new Error(/too_many/.test(await r.text()) ? "כבר שלחתם היום כמה דפים. אפשר שוב מחר" : "השליחה נכשלה. נסו שוב מאוחר יותר");
  return { frames: parts.length, chars: html.length };
}

// ---------- מודל ----------
// מוודאים שהכתובת השמורה היא באמת שורש המודל. אם נשמרה בלי תת-התיקייה (למשל moodle.bgu.ac.il
// במקום moodle.bgu.ac.il/moodle) ו-/my/ מחזיר 404 – מנסים עם /moodle ומתקנים את מה ששמור.
export async function resolveBase(base) {
  const r = await fetch(`${base}/my/`, { credentials: "include", method: "HEAD" }).catch(() => null);
  if (r && r.status !== 404) return base;
  const alt = base.replace(/\/+$/, "") + "/moodle";
  const r2 = await fetch(`${alt}/my/`, { credentials: "include", method: "HEAD" }).catch(() => null);
  if (r2 && r2.status !== 404) { await set({ moodle: alt }); return alt; }
  return base;
}
async function moodleSession(base) {
  const html = await (await fetch(`${base}/my/`, { credentials: "include" })).text();
  const m = html.match(/"sesskey":"([^"]+)"/);
  if (!m) throw Object.assign(new Error("צריך להיכנס למודל בכרום (פעם אחת, כרגיל)"), { code: "moodle_login" });
  return m[1];
}
async function ajax(base, sesskey, methodname, args) {
  const r = await fetch(`${base}/lib/ajax/service.php?sesskey=${sesskey}&info=${methodname}`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ index: 0, methodname, args }]),
  });
  const j = (await r.json())[0];
  // ההתחברות למודל פגה (קורה אחרי כמה שעות/ימים) – הודעה ברורה במקום השגיאה באנגלית של המודל
  if (j.error && /servicerequireslogin|requirelogin|logged out|expired|sesskey/i.test(`${j.exception?.errorcode} ${j.exception?.message}`))
    throw Object.assign(new Error("ההתחברות למודל פגה. לחצו 'פתיחת המודל', התחברו כרגיל, ואז 'בדיקה עכשיו'"), { code: "moodle_login" });
  if (j.error) throw new Error(j.exception?.message || "moodle error");
  return j.data;
}
// הפריטים בקורס: קבצים ותיקיות (Moodle 4 – אותו מידע שדף הקורס עצמו משתמש בו)
async function courseItems(base, sesskey, courseId, types = ["resource", "folder"]) {
  try {
    const st = JSON.parse(await ajax(base, sesskey, "core_courseformat_get_state", { courseid: courseId }));
    return (st.cm || []).filter((c) => types.includes(c.module) && c.uservisible !== false).map((c) => ({ id: c.id, type: c.module, name: c.name, url: c.url }));
  } catch {
    // גיבוי: קריאה מדף הקורס
    const html = await (await fetch(`${base}/course/view.php?id=${courseId}`, { credentials: "include" })).text();
    const out = [];
    for (const part of html.split('id="module-').slice(1)) {
      const id = +part.match(/^(\d+)/)?.[1], type = part.slice(0, 3000).match(/modtype_(\w+)/)?.[1];
      const name = (part.slice(0, 4000).match(/instancename">([^<]+)/)?.[1] || "").trim();
      if (id && types.includes(type)) out.push({ id, type, name, url: `${base}/mod/${type}/view.php?id=${id}` });
    }
    return out;
  }
}
// כתובות הקבצים שאפשר להוריד מפריט (קובץ בודד או תיקייה)
async function fileUrls(base, item) {
  if (item.type === "resource") {
    const r = await fetch(`${base}/mod/resource/view.php?id=${item.id}&redirect=1`, { credentials: "include" });
    if (r.url.includes("pluginfile.php")) return [{ url: r.url, res: r }];
    const html = await r.text();
    return [...new Set([...html.matchAll(/https?:\/\/[^"'\s]+pluginfile\.php[^"'\s]+/g)].map((m) => m[0].replace(/&amp;/g, "&")))].map((url) => ({ url }));
  }
  const html = await (await fetch(`${base}/mod/folder/view.php?id=${item.id}`, { credentials: "include" })).text();
  return [...new Set([...html.matchAll(/https?:\/\/[^"'\s]+pluginfile\.php[^"'\s]+/g)].map((m) => m[0].replace(/&amp;/g, "&").split("?")[0]))].map((url) => ({ url }));
}

// ---------- שרת Clearly ----------
async function rest(path, a, opts = {}) {
  return fetch(`${SB}/rest/v1/${path}`, { ...opts, headers: { apikey: ANON, Authorization: `Bearer ${a.access}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
}
// בתחילת כל בדיקה: פנייה קלה לשרת (דיווח הגרסה). אם השרת עונה 401 – ההתחברות ששמורה לא מתקבלת
// למרות שלפי התוסף היא עוד בתוקף (למשל שינוי מפתחות בשרת או קפיצה של שעון המחשב). אז מחדשים פעם אחת וממשיכים, במקום להיכשל שוב ושוב.
// הותקן מהחנות של כרום? (לגרסה מהחנות יש update_url; לגרסה שנטענה מקובץ – אין)
const FROM_STORE = !!chrome.runtime.getManifest().update_url;
// עותק ישן (מקובץ) כשיש כבר עותק מהחנות אצל אותו משתמש (נראה ב-14 הימים האחרונים): מפסיקים לסנכרן, כדי שלא יסוכם אותו קובץ פעמיים
export const STORE_TAKEOVER = "הותקנה גרסה מהחנות של כרום – הגרסה הזו הפסיקה לעבוד. אפשר להסיר אותה (בחלון של התוסף: \"הסרת הגרסה הישנה\").";
async function storeTookOver(a) {
  if (FROM_STORE) return false;
  try {
    const r = await rest("rpc/my_ext_version", a, { method: "POST", body: "{}" });
    if (!r.ok) return false;
    const seen = (await r.json())?.[0]?.ext_store_seen_at;
    return !!seen && Date.now() - new Date(seen).getTime() < 14 * 864e5;   // 14 יום (כמו באפליקציה): גם אחרי לילה שכרום היה סגור
  } catch { return false; }
}
async function liveToken() {
  let a = await token();
  // עותק מהחנות מדווח p_store (העותק מקובץ – רק גרסה, כמו קודם; כך זה עובד גם מול שרת ישן)
  const body = { p_version: chrome.runtime.getManifest().version, ...(FROM_STORE ? { p_store: true } : {}) };
  const report = (x) => rest("rpc/report_ext", x, { method: "POST", body: JSON.stringify(body) });
  const r = await report(a).catch(() => null);
  if (r?.status === 401) { a = await token(true); await report(a).catch(() => {}); }
  return a;
}
async function markItem(a, row) {
  await rest("moodle_items", a, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ owner: a.user, ...row }) });
}
async function sha256(blob) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// קריאה ארוכה לשרת: דרך דף הרקע (לא נכבה אחרי 30 שניות). אם הוא לא זמין – קריאה רגילה
async function ensureOffscreen() {
  try {
    if (!chrome.offscreen) return false;
    if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return true;
    await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["BLOBS"], justification: "קריאה ארוכה לשרת הסיכומים, שלא תיקטע כשהרקע של התוסף נכבה" });
    return true;
  } catch (e) { return /single offscreen|already/i.test(String(e)); }
}
export async function longPost(url, headers, body) {
  if (await ensureOffscreen()) {
    let r = null;
    try { r = await chrome.runtime.sendMessage({ cmd: "longPost", url, headers, body }); } catch { /* ממשיכים לקריאה רגילה */ }
    if (r?.netError) throw Object.assign(new Error("network"), { code: "network" });
    if (r) return { ok: r.ok, status: r.status, json: async () => JSON.parse(r.text) };
  }
  return fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(170000) }).catch((e) => { throw Object.assign(new Error("network"), { code: "network", cause: e }); });
}
// ---------- מצגת/וורד גדולים: הטקסט נקרא מתוך קובץ ה-zip בלי לשלוח את כל הקובץ ----------
async function zipFiles(buf, want) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    if (!want(name)) continue;
    const st = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = buf.subarray(st, st + csize);
    out[name] = method === 0 ? new TextDecoder().decode(data) : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}
export async function officeText(buf, filename) {
  const pptx = /\.pptx$/i.test(filename);
  const files = await zipFiles(buf, (n) => (pptx ? /^ppt\/slides\/slide\d+\.xml$/ : /^word\/document\.xml$/).test(n));
  const names = Object.keys(files).sort((x, y) => Number(x.match(/\d+/)?.[0] ?? 0) - Number(y.match(/\d+/)?.[0] ?? 0));
  const tag = pptx ? "a:t" : "w:t";
  const parts = names.map((n, i) => {
    const t = [...files[n].matchAll(new RegExp("<" + tag + "[^>]*>([^<]*)</" + tag + ">", "g"))].map((m) => m[1]).join(" ");
    return pptx ? "--- שקף " + (i + 1) + " ---\n" + t : t;
  });
  const text = parts.join("\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").slice(0, 300000);
  if (text.replace(/[-\s\d]|שקף/g, "").length < 80) throw Object.assign(new Error("no_text"), { code: "unsupported" });
  return text;
}
async function summarizeText(a, text, filename, course, ref) {
  const body = JSON.stringify({ filename, text, course, source: "moodle", source_ref: ref });
  const r = await longPost(`${SB}/functions/v1/summarize`, { apikey: ANON, Authorization: `Bearer ${a.access}`, "Content-Type": "application/json" }, body);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "failed"), { code: j.error });
  return j;
}
async function summarize(a, blob, filename, course, ref) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024 && OFFICE_EXT.test(filename)) return summarizeText(a, await officeText(buf, filename), filename, course, ref);
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const body = JSON.stringify({ filename, mime: blob.type, data: btoa(bin), course, source: "moodle", source_ref: ref });
  const r = await longPost(`${SB}/functions/v1/summarize`, { apikey: ANON, Authorization: `Bearer ${a.access}`, "Content-Type": "application/json" }, body);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "failed"), { code: j.error });
  return j;
}

// ---------- חיפוש בתוך חומרי הקורס (1.6.14) ----------
// הטקסט של כל עמוד בקבצי הקורס נקרא כאן במחשב (בלי AI, לא נספר במכסה), נדחס, ונשמר בתיקייה הפרטית של הסטודנט/ית.
// האפליקציה (גם באייפד) מחפשת בו: "באיזה עמוד במצגת המרצה הסביר את X". הקובץ של המרצה עצמו לא נשמר אצלנו.
const TEXT_MAX = 25;          // בכל בדיקה אוטומטית – עד 25 קבצים ישנים (קבצים חדשים נקראים מיד אחרי הסיכום)
const TEXT_MANUAL_MAX = 80;   // כשלוחצים "בדיקה עכשיו"
const TEXT_MS = 4 * 60 * 1000;
async function hexOf(s) { const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); return [...d].map((b) => b.toString(16).padStart(2, "0")).join(""); }
// סוגי תקלות: "setup" = בעיה אצלנו/בכרום (לא בקובץ) – עוצרים ומנסים בבדיקה הבאה, בלי לסמן את הקובץ.
// "file" = הקובץ עצמו פגום/מוגן – אחרי 3 ניסיונות מוותרים עליו.
const setupErr = (m) => Object.assign(new Error(m), { code: "setup" });
async function pdfTextPages(buf) {
  if (!(await ensureOffscreen())) throw setupErr("no_offscreen");
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  let r;
  try { r = await chrome.runtime.sendMessage({ cmd: "pdfText", data: btoa(bin) }); } catch (e) { throw setupErr("offscreen_msg " + e.message); }
  if (!r) throw setupErr("offscreen_no_reply");
  if (r.error) throw Object.assign(new Error(r.error), { code: "file" });
  return r.pages;
}
// מה שירד מהמודל באמת קובץ? (כשההתחברות למודל פגה מגיע דף HTML של התחברות במקום הקובץ)
function looksLike(buf, fname) {
  const head = new TextDecoder("latin1").decode(buf.subarray(0, 1024));
  return /\.pdf$/i.test(fname) ? head.includes("%PDF") : head.startsWith("PK");
}
// מצגת: עמוד = שקף. וורד: חלקים של כ-1,800 תווים (בגבולות פסקה)
export function officePages(text, pptx) {
  if (pptx) return text.split(/--- שקף \d+ ---\n?/).slice(1).map((t) => t.trim());
  const out = []; let cur = "";
  // בוורד אין שורות – חותכים גם בסוף משפט
  for (const para of text.split(/\n+|(?<=[.!?:])\s+/)) { if (cur && cur.length + para.length > 1800) { out.push(cur.trim()); cur = ""; } cur += para + " "; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// מחזיר "ok" (נשמר), "empty" (אין טקסט, למשל סריקה), או זורק שגיאה
export async function indexText(a, buf, fname, course, fkey, url) {
  // לא קובץ אמיתי: או שההתחברות למודל פגה (אז כל הקבצים ייראו ככה), או שהקובץ הזה נמחק/חסום במודל
  if (!looksLike(buf, fname)) throw Object.assign(new Error("not_a_file"), { code: "notfile" });
  let pages = [];
  if (/\.pdf$/i.test(fname)) pages = await pdfTextPages(buf);
  else if (OFFICE_EXT.test(fname)) { try { pages = officePages(await officeText(buf, fname), /\.pptx$/i.test(fname)); } catch (e) { if (e.code !== "unsupported") throw e; } }
  if (!pages.join("").replace(/\s/g, "")) return "empty";
  const json = JSON.stringify({ v: 1, key: fkey, course, name: fname, url, at: new Date().toISOString(), pages });
  const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
  const name = (await hexOf(fkey)).slice(0, 32) + ".json.gz";
  const r = await fetch(`${SB}/storage/v1/object/course-texts/${a.user}/${name}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${a.access}`, "x-upsert": "true", "Content-Type": "application/gzip", "cache-control": "0" }, body: gz });
  // 5xx = השרת עמוס (ננסה שוב). 4xx = אין הרשאה/אין מקום אחסון (למשל עוד לא הוגדר בשרת) – זו לא בעיה של הקובץ
  // 413 = הטקסט של הקובץ הזה גדול מדי – בעיה של הקובץ, לא של כולם
  if (!r.ok) throw Object.assign(new Error("upload " + r.status), { code: r.status >= 500 ? "network" : r.status === 413 ? "file" : "setup" });
  return "ok";
}
// קבצים שסוכמו בגרסאות קודמות (או שלא מסוכמים בכלל, כמו תרגילים ופתרונות) – נקראים בהדרגה, כמה בכל בדיקה
async function indexBacklog(a, base, files, seen, manual) {
  const lim = manual ? TEXT_MANUAL_MAX : TEXT_MAX, t0 = Date.now();
  let n = 0, left = 0, pendingDead = null;
  // קובץ אחד שלא יורד = כנראה נמחק במודל: ממשיכים לבא, ונספר לו ניסיון רק אם הבא כן ירד.
  // שניים ברצף = כנראה ההתחברות למודל פגה: עוצרים בלי לספור לאף אחד מהם
  const fail = (k) => { seen["tn:" + k] = (seen["tn:" + k] || 0) + 1; if (seen["tn:" + k] >= 3) seen["t:" + k] = "x"; };
  const commitDead = () => { if (pendingDead) { fail(pendingDead); pendingDead = null; } };
  for (const it of files) {
    if (it.type === "resource" && seen["t:" + it.key]) continue;
    if (n >= lim || Date.now() - t0 > TEXT_MS) { left++; continue; }
    let urls;
    try { urls = await fileUrls(base, it); } catch { left++; continue; }
    for (const f of urls) {
      const fname = decodeURIComponent(f.url.split("?")[0].split("/").pop() || it.name);
      const fkey = it.type === "folder" ? `${it.key}:${fname}` : it.key;
      if (seen["t:" + fkey]) continue;
      if (!OK_EXT.test(fname)) { seen["t:" + fkey] = "x"; continue; }
      if (n >= lim || Date.now() - t0 > TEXT_MS) { left++; continue; }
      try {
        await status({ state: `קורא לחיפוש: ${it.name}` });
        const blob = await (f.res || (await fetch(f.url, { credentials: "include" }))).blob();
        if (blob.size > (OFFICE_EXT.test(fname) ? 250 : 30) * 1024 * 1024) { seen["t:" + fkey] = "big"; continue; }
        seen["t:" + fkey] = await indexText(a, new Uint8Array(await blob.arrayBuffer()), fname, it.course, fkey, it.url);
        n++; commitDead();
      } catch (e) {
        if (e.code === "notfile") {
          if (pendingDead) {
            // שניים ברצף: בודקים את ההתחברות למודל עצמה. מחובר = הקבצים באמת מתים (נספר להם ניסיון וממשיכים); לא מחובר = עוצרים
            let loggedIn = false; try { await moodleSession(base); loggedIn = true; } catch { /* ההתחברות פגה */ }
            if (!loggedIn) { pendingDead = null; await set({ seen }); return { n, left: left + 1, stopped: "moodle_login" }; }
            commitDead(); fail(fkey); continue;
          }
          pendingDead = fkey; continue;
        }
        // רשת, או בעיה שאינה בקובץ (שרת לא מוכן, דף הרקע) – עוצרים בלי לסמן, ננסה בבדיקה הבאה
        if (e.code === "network" || e.code === "setup" || e instanceof TypeError) { await set({ seen }); return { n, left: left + 1, stopped: e.code || "network" }; }
        // הקובץ עצמו לא נקרא (פגום/מוגן/גדול מדי): אחרי 3 ניסיונות (בבדיקות שונות) מוותרים עליו
        commitDead(); fail(fkey);
      }
    }
    if (it.type === "resource" && !urls.length) seen["t:" + it.key] = "x";   // פריט בלי קובץ להורדה
    await set({ seen });
  }
  commitDead(); await set({ seen });
  return { n, left };
}

// ---------- בדיקה אחת: מה חדש במודל -> סיכום ----------
let running = false;
export async function syncOnce({ manual = false } = {}) {
  if (running) return get("status");
  running = true;
  // כרום מכבה את הרקע של התוסף אחרי ~30 שניות בלי פעילות, וסיכום אחד לוקח לפעמים יותר (גוגל חושב). זה מה שעצר את הסנכרון באמצע
  // ("Failed to fetch"). קריאה קלה כל 20 שניות מחזיקה אותו ער כל זמן שהסנכרון רץ.
  const keepAlive = setInterval(() => { chrome.runtime.getPlatformInfo(() => {}); }, 20000);
  try {
    const a = await liveToken();   // גם מדווח לשרת איזו גרסה מותקנת (בשביל "יש עדכון לתוסף")
    if (await storeTookOver(a)) return await status({ state: "", error: STORE_TAKEOVER, storeTakeover: true });
    let base = await get("moodle");
    if (!base) throw new Error("בחרו את המודל שלכם (לחצו על סמל התוסף)");
    await status({ state: "בודק את המודל…", error: "" });
    base = await resolveBase(base);
    const sesskey = await moodleSession(base);
    const courses = (await ajax(base, sesskey, "core_course_get_enrolled_courses_by_timeline_classification", { classification: "inprogress", limit: 0, offset: 0, sort: "fullname" })).courses || [];
    // מטלות ומועדי הגשה (לאפליקציה), ועבודות שחיכו להגשה מהאפליקציה
    try { await syncAssignments(a, base, sesskey, courses); } catch { /* לא חובה */ }
    try { await submitJobs(); } catch { /* ננסה בפעם הבאה */ }
    // חומרים לכל קורס + קישור לזום (לאפליקציה: "חומרים לשיעור" ויומן)
    try { await syncCourseMaterials(a, base, sesskey, courses); } catch { /* לא חובה */ }
    // מערכת שעות ומבחנים מהמידע האישי (פעם ביום, או כשלוחצים "בדיקה עכשיו")
    let portal = "";
    if (!PORTALS[base]) portal = "🕘 מערכת שעות אוטומטית עדיין לא זמינה למוסד שלך. אפשר להוסיף שיעורים ידנית באפליקציה (מערכת השעות שלי), כולל חדר ומרצה.";
    else try { const p = await syncPortal(a, base, courses, rest, manual); if (p) portal = `🕘 מערכת שעות: ${p.lessons} שיעורים בשבוע · ${p.exams} מבחנים`; }
    catch (e) { portal = "🕘 " + e.message; }
    if (portal) await status({ portal });
    const seen = (await get("seen")) || {};
    // מה שכבר סוכם אצלנו בשרת (גם אם הזיכרון המקומי נמחק, למשל אחרי התנתקות והתחברות מחדש): לא מסכמים שוב
    try {
      const r = await rest("moodle_items?select=item_key,status,note&status=in.(done,skipped)&limit=2000", a);
      if (r.ok) for (const x of await r.json()) if (x.item_key && !seen[x.item_key]) { if (x.status === "done") seen[x.item_key] = "done"; else if (/30MB|250MB/.test(x.note || "")) seen[x.item_key] = "big"; }
    } catch { /* לא חובה: ממשיכים עם הזיכרון המקומי */ }
    // קבצים שנכשלו בגלל תקלה אצלנו (למשל ה-AI לא עבד) וסומנו בשרת "לנסות שוב" (note = retry): חוזרים לתור,
    // גם אם כבר נכשלו 3 פעמים. אחרי סיכום מוצלח הם מסומנים "done" – אז לא חוזרים שוב.
    try {
      const r = await rest("moodle_items?select=item_key&status=eq.failed&note=eq.retry&limit=500", a);
      if (r.ok) for (const x of await r.json()) if (x.item_key && seen[x.item_key] !== "done") { delete seen[x.item_key]; delete seen["n:" + x.item_key]; }
    } catch { /* לא חובה */ }
    // פעם אחת: קבצים ישנים שבגרסאות קודמות סומנו "ישן" (ולא סוכמו) חוזרים לתור – מסכמים את כל הסמסטר
    if (!(await get("backfill1"))) {
      for (const k of Object.keys(seen)) if (seen[k] === "old") delete seen[k];
      await set({ seen, backfill1: true });
    }
    // פעם אחת (1.6.8): ב-9.11 השרת נכשל זמנית (תקלת הרשאה אצלנו) וקבצים תקינים סומנו "לדלג" אחרי 3 כישלונות – מחזירים אותם לתור
    if (!(await get("heal168"))) {
      for (const k of Object.keys(seen)) {
        if (k.startsWith("n:")) { const f = k.slice(2); if (seen[f] === "skip" && seen[k] >= 3) delete seen[f]; delete seen[k]; }
      }
      await set({ seen, heal168: true });
    }
    // פעם אחת (1.6.10): קבצים שסומנו "לדלג" רק כי הרקע של התוסף נכבה באמצע ("Failed to fetch") חוזרים לתור
    if (!(await get("heal1610"))) {
      for (const k of Object.keys(seen)) {
        if (k.startsWith("n:")) { const f = k.slice(2); if (seen[f] === "skip") delete seen[f]; delete seen[k]; }
        else if (seen[k] === "retry") delete seen[k];
      }
      await set({ seen, heal1610: true });
    }
    // פעם אחת (1.6.11): קבצים שנדלגו כי הם גדולים מ-15MB חוזרים לתור (מצגת/וורד: הטקסט נקרא מקומית, PDF עד 30MB)
    if (!(await get("heal1611"))) {
      for (const k of Object.keys(seen)) if (seen[k] === "big") delete seen[k];
      await set({ seen, heal1611: true });
    }
    // כל הקבצים מתחילת הסמסטר, מהחדש לישן, לסירוגין בין הקורסים (כך כל קורס מקבל סיכומים מהר).
    // הקצב מוגבל במכסה היומית בשרת, אז זה נגמר תוך כמה ימים – ממשיכים לבד בכל בדיקה.
    const perCourse = [], allFiles = [];
    for (const c of courses) {
      const course = (c.fullname || c.shortname || "").trim();
      if (NOT_COURSE.test(course)) continue;
      const items = await courseItems(base, sesskey, c.id);
      // לחיפוש: כל הקבצים של הקורס (גם תרגילים, פתרונות וסילבוס – לא רק מה שמסוכם)
      for (const it of items) allFiles.push({ ...it, key: `${new URL(base).host}:${it.id}`, course });
      const list = [];
      // רק חומר שיעור, בלי תרגילים/פתרונות/נתונים/חומר של שנה שעברה ובלי כפילויות (classify.js)
      for (const it of planCourse(items).keep) {
        const key = `${new URL(base).host}:${it.id}`;
        if (it.type === "resource" && seen[key] && seen[key] !== "retry") continue;
        list.push({ ...it, key, course });
      }
      perCourse.push(list.reverse());
    }
    const todo = [];
    for (let i = 0; perCourse.some((l) => i < l.length); i++) for (const l of perCourse) if (l[i]) todo.push(l[i]);
    const backlog = todo.filter((q) => q.type === "resource").length;
    // מדווחים לשרת כמה קבצי שיעור נשארו בתור: למשתמש חדש עם הרבה קבצים השרת נותן מכסה יומית גבוהה יותר (50/40/30)
    try { await rest("rpc/report_backlog", a, { method: "POST", body: JSON.stringify({ p_remaining: backlog }) }); } catch { /* לא חובה */ }
    let done = 0, made = 0, stop = "", netFails = 0;
    const perRun = manual ? MANUAL_MAX : PER_RUN_MAX;
    for (const it of todo) {
      if (made >= perRun) break;
      try {
        for (const f of await fileUrls(base, it)) {
          const fname = decodeURIComponent(f.url.split("?")[0].split("/").pop() || it.name);
          const fkey = it.type === "folder" ? `${it.key}:${fname}` : it.key;
          if (seen[fkey] && seen[fkey] !== "retry") continue;
          if (!OK_EXT.test(fname)) { seen[fkey] = "skip"; continue; }
          const res = f.res || (await fetch(f.url, { credentials: "include" }));
          const blob = await res.blob();
          // מצגת/וורד גדולים (הרבה תמונות): לא שולחים את הקובץ, מוציאים את הטקסט מקומית ושולחים רק אותו. PDF עד 30MB (השרת מעלה אותו ל-Gemini)
          if (blob.size > (OFFICE_EXT.test(fname) ? 250 : 30) * 1024 * 1024) { seen[fkey] = "big"; await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "skipped", note: OFFICE_EXT.test(fname) ? "גדול מ-250MB" : "גדול מ-30MB" }); continue; }
          const hash = await sha256(blob);
          if (seen["h:" + hash]) { seen[fkey] = "dup"; continue; }   // אותו קובץ כבר סוכם (גם אם הועלה בשם אחר)
          await status({ state: `מסכם: ${it.name}` });
          try {
            await summarize(a, blob, fname, it.course, fkey);
            seen[fkey] = "done"; seen["h:" + hash] = 1; made++; netFails = 0;
            await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "done" });
            // הקובץ כבר כאן: קוראים גם את הטקסט שלו לחיפוש (לא חובה – אם נכשל, ננסה שוב בהשלמה)
            if (!seen["t:" + fkey]) try { seen["t:" + fkey] = await indexText(a, new Uint8Array(await blob.arrayBuffer()), fname, it.course, fkey, it.url); } catch { /* ננסה בהשלמה */ }
          } catch (e) {
            if (e.code === "limit" || e.code === "global_cap") { seen[fkey] = "retry"; stop = "הגעתם למכסת הסיכומים להיום – נמשיך מחר"; break; }
            // תקלת רשת/זמן (למשל גוגל איטי): לא קשור לקובץ. לא סופרים ככישלון של הקובץ, ואחרי 3 ברצף עוצרים ומנסים בריצה הבאה
            if (e.code === "network") { seen[fkey] = "retry"; if (++netFails >= 3) { stop = "החיבור לשרת איטי כרגע – ננסה שוב עוד רגע"; break; } continue; }
            netFails = 0;
            seen["n:" + fkey] = (seen["n:" + fkey] || 0) + 1;   // אחרי 3 כישלונות מפסיקים לנסות את הקובץ הזה
            seen[fkey] = e.code === "unsupported" || seen["n:" + fkey] >= 3 ? "skip" : "retry";
            await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "failed", note: String(e.code || e.message).slice(0, 100) });
          }
          if (made >= perRun) break;
        }
        if (it.type === "resource" && seen[it.key] !== "retry") seen[it.key] = seen[it.key] || "done";
        done++;
      } catch { /* פריט שלא נפתח – ננסה בפעם הבאה */ }
      await set({ seen });
      if (stop) break;
    }
    await set({ seen });
    // השלמה לחיפוש: קבצים שעוד לא נקראו (בלי AI ובלי מכסה). לא כשהחיבור איטי
    let idx = { n: 0, left: 0 };
    if (!/איטי/.test(stop)) try { idx = await indexBacklog(a, base, allFiles, seen, manual); } catch { /* לא חובה */ }
    await set({ seen, textLeft: idx.left });
    chrome.action.setBadgeText({ text: made ? String(made) : "" });
    const left = Math.max(backlog - made, 0);
    const more = (left ? ` · נשארו עוד כ-${left} קבצים מהסמסטר – ממשיכים לבד (לפי המכסה היומית)` : "") + (idx.n ? ` · 🔍 ${idx.n} קבצים נוספו לחיפוש באפליקציה` : "");
    await set({ backlogLeft: left });
    return await status({ state: (stop || (made ? `✅ ${made} סיכומים חדשים נשלחו לאפליקציה` : "✅ אין קבצים חדשים")) + more, courses: courses.length, error: "", storeTakeover: false, last: new Date().toISOString() });
  } catch (e) {
    chrome.action.setBadgeText({ text: "!" });
    return await status({ state: "", error: e.message, needMoodle: e.code === "moodle_login" });
  } finally { clearInterval(keepAlive); running = false; }
}

// ---------- הגשת עבודות: מה שהאפליקציה שלחה -> המטלה במודל ----------
// האפליקציה (גם בטאבלט) מעלה את הקובץ לאחסון זמני ויוצרת "משימת הגשה". כאן, בכרום עם ההתחברות למודל:
// מורידים את הקובץ, שמים אותו בטופס ההגשה של המטלה (כמו שסטודנט עושה), שומרים, קוראים את המצב במודל,
// ומוחקים את הקובץ מהאחסון שלנו. ב"שליחה" הסופית במודל לא נוגעים – אותה עושה הסטודנט/ית.
const txt = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function formFields(formHtml) {
  const out = {};
  for (const tag of formHtml.match(/<input[^>]*>/g) || []) {
    const n = tag.match(/name="([^"]+)"/)?.[1]; if (!n) continue;
    out[n] = (tag.match(/value="([^"]*)"/)?.[1] || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  }
  return out;
}
// מצב ההגשה כפי שהוא מופיע בדף המטלה
async function assignStatus(base, cmid) {
  const html = await (await fetch(`${base}/mod/assign/view.php?id=${cmid}`, { credentials: "include" })).text();
  for (const [, th, td] of html.matchAll(/<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    if (/מצב ההגשה|Submission status/i.test(txt(th))) return txt(td);
  }
  return "";
}
async function uploadToMoodle(base, cmid, blob, fileName) {
  const edit = await (await fetch(`${base}/mod/assign/view.php?id=${cmid}&action=editsubmission`, { credentials: "include" })).text();
  const sesskey = edit.match(/"sesskey":"([^"]+)"/)?.[1];
  if (!sesskey) throw Object.assign(new Error("צריך להיכנס למודל בכרום"), { code: "moodle_login" });
  const form = [...edit.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/g)].find((m) => m[2].includes("files_filemanager"));
  if (!form) throw new Error("במטלה הזו אי אפשר להעלות קובץ (אולי ההגשה סגורה או שהיא לא דרך המודל)");
  const fields = formFields(form[2]);
  const itemid = fields.files_filemanager;
  const repoId = edit.match(/"id":"?(\d+)"?,"name":"[^"]*","type":"upload"/)?.[1] || "";
  const ctx = edit.match(/"contextid":(\d+)/)?.[1] || "";
  // 1. הקובץ לאזור הזמני של הטופס
  const fd = new FormData();
  for (const [k, v] of Object.entries({ sesskey, repo_id: repoId, itemid, author: "", license: "unknown", title: fileName, savepath: "/", maxbytes: "-1", areamaxbytes: "-1", ctx_id: ctx, env: "filemanager" })) fd.append(k, v);
  fd.append("repo_upload_file", blob, fileName);
  const up = await (await fetch(`${base}/repository/repository_ajax.php?action=upload`, { method: "POST", credentials: "include", body: fd })).json();
  if (up.error) throw new Error("המודל לא קיבל את הקובץ: " + String(up.error).slice(0, 120));
  // 2. שמירת הטופס (כמו "שמירת שינויים")
  const body = new URLSearchParams(fields);
  body.set("sesskey", sesskey); body.set("files_filemanager", itemid); body.delete("cancel");
  if (!body.get("submitbutton")) body.set("submitbutton", "שמירת שינויים");
  const action = (form[1].match(/action="([^"]+)"/)?.[1] || `${base}/mod/assign/view.php`).replace(/&amp;/g, "&");
  const saved = await fetch(new URL(action, base + "/"), { method: "POST", credentials: "include", body });
  if (!saved.ok) throw new Error(`השמירה במודל נכשלה (${saved.status})`);
  // 3. מה המצב עכשיו במודל
  return assignStatus(base, cmid);
}
export async function submitJobs() {
  const a = await liveToken();
  if (await storeTookOver(a)) return 0;
  const base = await get("moodle");
  if (!base) return 0;
  const jobs = await (await rest("submission_jobs?status=eq.queued&order=created_at.asc&limit=5", a)).json();
  if (!Array.isArray(jobs) || !jobs.length) return 0;
  const mark = (id, st, result = "") => rest(`submission_jobs?id=eq.${id}`, a, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: st, result: result.slice(0, 500) }) });
  let n = 0;
  for (const j of jobs) {
    await mark(j.id, "uploading");
    await status({ state: `מגיש למודל: ${j.assign_name}` });
    const obj = `${SB}/storage/v1/object/submissions/${j.file_path.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const fr = await fetch(obj, { headers: { apikey: ANON, Authorization: `Bearer ${a.access}` } });
      if (!fr.ok) throw new Error("הקובץ לא נמצא בשרת");
      const st = await uploadToMoodle(base, j.cmid, await fr.blob(), j.file_name);
      const final = /הוגש|נשלח|submitted for grading/i.test(st) && !/טיוטה|draft/i.test(st);
      await mark(j.id, final ? "submitted" : "draft", st || "נשמר במודל");
      n++;
    } catch (e) {
      await mark(j.id, "failed", e.message);
      if (e.code === "moodle_login") break;
    } finally {
      // הקובץ לא נשאר אצלנו – גם אם משהו נכשל (אפשר לשלוח שוב מהאפליקציה)
      await fetch(obj, { method: "DELETE", headers: { apikey: ANON, Authorization: `Bearer ${a.access}` } }).catch(() => {});
    }
  }
  return n;
}

// ---------- חומרים לכל קורס + קישור לזום ----------
// כל הפריטים בדף הקורס (קבצים, תיקיות, קישורים), ואם יש פריט זום – הקישור עצמו
async function courseZoomAndItems(base, sesskey, courseId) {
  const st = JSON.parse(await ajax(base, sesskey, "core_courseformat_get_state", { courseid: courseId }));
  const cms = (st.cm || []).filter((c) => c.uservisible !== false && c.url && c.name && c.module !== "label");
  const items = cms.map((c) => ({ type: c.module, name: String(c.name).slice(0, 200), url: String(c.url).slice(0, 500) }));
  let zoom = "";
  const zc = cms.find((c) => /zoom|זום/i.test(c.name) && ["url", "lti", "zoom"].includes(c.module));
  if (zc) {
    zoom = zc.url;
    if (zc.module === "url") {
      try {
        const html = await (await fetch(`${base}/mod/url/view.php?id=${zc.id}&redirect=0`, { credentials: "include" })).text();
        zoom = (html.match(/https?:\/\/[^"'\s<>]*zoom\.us\/[^"'\s<>]+/)?.[0] || zc.url).replace(/&amp;/g, "&");
      } catch { /* נשאר הקישור למודל */ }
    }
  }
  return { zoom: zoom.slice(0, 1000), items: items.slice(0, 300) };
}
async function syncCourseMaterials(a, base, sesskey, courses) {
  for (const c of courses) {
    const course = (c.fullname || c.shortname || "").trim().slice(0, 200);
    if (!course) continue;
    try {
      const m = await courseZoomAndItems(base, sesskey, c.id);
      await rest("course_materials", a, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ owner: a.user, course, zoom: m.zoom || null, items: m.items, updated_at: new Date().toISOString() }) });
    } catch { /* קורס שלא נפתח – בפעם הבאה */ }
  }
}

// ---------- מטלות מהמודל -> לאפליקציה (גם לטאבלט) ----------
// העלאת קובץ מצורף של מטלה לאחסון הפרטי (assignment-files/<uid>/<cmid>/<name>)
async function uploadAssignFile(a, path, blob) {
  const r = await fetch(`${SB}/storage/v1/object/assignment-files/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${a.access}`, "x-upsert": "true", "Content-Type": blob.type || "application/octet-stream" }, body: blob,
  });
  return r.ok;
}
// ההוראות של המרצה (intro) והקבצים המצורפים, מתוך דף המטלה
async function assignDetail(base, cmid) {
  const res = await fetch(`${base}/mod/assign/view.php?id=${cmid}`, { credentials: "include" });
  if (!res.ok) throw new Error("assign page " + res.status);   // דף שלא נטען → לא יודעים (לא "לא הוגש")
  const html = await res.text();
  // אזור התיאור (id="intro") -> טקסט עם שורות
  let intro = "";
  const m = html.match(/id="intro"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  if (m) intro = m[1].replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h\d|tr)>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "").slice(0, 8000);
  // קבצים מצורפים לתיאור
  const urls = [...new Set([...html.matchAll(/https?:\/\/[^"'\s]+pluginfile\.php\/[^"'\s]*mod_assign\/intro[^"'\s]+/g)].map((x) => x[0].replace(/&amp;/g, "&")))];
  return { intro, urls, submitted: isSubmitted(html) };
}
// מטלות ובחנים מהמודל נשמרים כפריטי מודל (assign / quiz): המועד בהערה (ISO), ריק אם אין מועד.
// שלושה מקורות, כדי לא לפספס כלום: (1) פעולות פתוחות, (2) לוח השנה החודשי של המודל (כולל מה שכבר הוגש),
// (3) פעילויות בתוך הקורסים שאין להן מועד בכלל. בלי (2) ו-(3) חסרו בחנים, מטלות בלי מועד ומטלות שהוגשו.
async function syncAssignments(a, base, sesskey, courses = []) {
  const now = Math.floor(Date.now() / 1000);
  const seen = (await get("seen")) || {};
  const nameById = new Map(courses.map((c) => [String(c.id), String(c.fullname || c.shortname || "").trim()]));
  // מה שכבר סומן "הוגש" בשרת נשאר כך, גם אם בריצה הזו לא הצלחנו לבדוק את דף המטלה
  const doneBefore = new Set();
  try { const r = await rest("moodle_items?select=item_key&status=eq.done&kind=in.(assign,quiz)&limit=1000", a); if (r.ok) for (const x of await r.json()) doneBefore.add(x.item_key); } catch { /* לא חובה */ }
  const found = new Map();
  const put = (x) => { const k = `${x.kind}:${x.cmid}`, prev = found.get(k) || {}, nx = { ...prev }; for (const [a1, b1] of Object.entries(x)) if (b1 !== undefined && b1 !== "" && b1 !== 0) nx[a1] = b1; found.set(k, nx); };
  const loginErr = (e) => { if (e?.code === "moodle_login") throw e; };
  try {
    const data = await ajax(base, sesskey, "core_calendar_get_action_events_by_timesort", { limitnum: 50, timesortfrom: now - 86400, timesortto: now + 90 * 86400 });
    for (const ev of data.events || []) {
      if ((ev.modulename || "") !== "assign") continue;
      const cmid = String(ev.url || "").match(/[?&]id=(\d+)/)?.[1]; if (!cmid) continue;
      put({ cmid, kind: "assign", name: cleanName(ev.name), ts: Number(ev.timesort || 0), course: String(ev.course?.fullname || "").trim(), courseId: ev.course?.id, url: String(ev.url), actionable: ev.action ? ev.action.actionable !== false : undefined });
    }
  } catch (e) { loginErr(e); }
  const d0 = new Date();
  for (let k = -1; k <= 3; k++) {
    const d = new Date(d0.getFullYear(), d0.getMonth() + k, 1);
    try {
      const data = await ajax(base, sesskey, "core_calendar_get_calendar_monthly_view", { year: d.getFullYear(), month: d.getMonth() + 1, courseid: 1, categoryid: 0, includenavigation: false, mini: false, day: 1 });
      for (const x of activityEvents(flattenMonthly(data))) put(x);
    } catch (e) { loginErr(e); }
  }
  for (const c of courses) {
    const course = String(c.fullname || c.shortname || "").trim();
    if (!course || NOT_COURSE.test(course)) continue;
    try { for (const it of await courseItems(base, sesskey, c.id, ["assign", "quiz"])) if (!found.has(`${it.type}:${it.id}`)) put({ cmid: String(it.id), kind: it.type, name: it.name, ts: 0, course, url: it.url }); } catch (e) { loginErr(e); }
  }
  let n = 0;
  // אילו מטלות לבדוק בדף שלהן (עד 60): קודם הקרובות ביותר להיום – כדי שהמטלות הדחופות תמיד ייבדקו
  const detailKeys = new Set([...found.values()].filter((x) => x.kind === "assign" && !(x.ts && x.ts < now - 30 * 86400))
    .sort((p, q) => (p.ts ? Math.abs(p.ts - now) : Infinity) - (q.ts ? Math.abs(q.ts - now) : Infinity))
    .slice(0, 60).map((x) => x.cmid));
  for (const x of [...found.values()].sort((p, q) => (q.ts || 0) - (p.ts || 0)).slice(0, 150)) {
    if (x.ts && x.ts < now - 30 * 86400) continue;   // ישן מחודש: לא מעניין
    const course = nameById.get(String(x.courseId)) || x.course || "";
    if (NOT_COURSE.test(course)) continue;
    if (x.kind === "quiz" && !x.ts) continue;   // בוחן בלי מועד לא מוצג בשום מקום (למשל בחני תרגול), לא שומרים
    let intro = "", files = [], page = null;
    if (x.kind === "assign" && detailKeys.has(x.cmid)) {
      try {
        const d = await assignDetail(base, x.cmid);
        intro = d.intro; page = d.submitted;
        for (const url of d.urls.slice(0, 5)) {
          const fname = decodeURIComponent(url.split("?")[0].split("/").pop() || "קובץ");
          const path = `${a.user}/${x.cmid}/${fname}`;
          const fkey = `af:${x.cmid}:${fname}`;
          if (!seen[fkey]) {
            const blob = await (await fetch(url, { credentials: "include" })).blob();
            if (blob.size <= 25 * 1024 * 1024 && await uploadAssignFile(a, path, blob)) { seen[fkey] = "done"; }
          }
          files.push({ name: fname, path });
        }
      } catch { /* אם דף המטלה לא נפתח – לפחות השם והמועד */ }
    }
    const submitted = decideSubmitted({ kind: x.kind, before: doneBefore.has(`${x.kind}:${x.cmid}`), page });
    try {
      await markItem(a, { item_key: `${x.kind}:${x.cmid}`, course: course.slice(0, 200), name: String(x.name || "").slice(0, 300), kind: x.kind, url: String(x.url || "").slice(0, 2000),
        status: submitted ? "done" : "new", note: dueIso(x.ts), ...(x.kind === "assign" ? { intro: intro || null, files } : {}) });
      n++;
    } catch { /* שורה בעייתית לא עוצרת את השאר */ }
  }
  await set({ seen });
  return n;
}
