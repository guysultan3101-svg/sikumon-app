// המחבר של Clearly – הלוגיקה: התחברות ל-Clearly, קריאת הקורסים מהמודל (עם ההתחברות הרגילה של הסטודנט
// בכרום), איתור קבצים חדשים, ושליחתם לסיכום אישי בשרת. לא רואים ולא שומרים את הסיסמה למודל.
import { syncPortal, PORTALS } from "./portal.js";
import { planCourse } from "./classify.js";
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
const PER_RUN_MAX = 15;    // בכל בדיקה אוטומטית – עד 15 קבצים (המכסה היומית בשרת מגבילה בנוסף)
const MANUAL_MAX = 50;     // כשלוחצים "בדיקה עכשיו"
// "קורסים" שהם בעצם לומדות והדרכות של המוסד – לא מסכמים אותם
const NOT_COURSE = /הטרדה|harassment|לומדה|הכרת הספרייה|הדרכה לקראת|instructions for|בטיחות ב|safety/i;
const OK_EXT = /\.(pdf|pptx|docx)$/i;

const get = (k) => chrome.storage.local.get(k).then((o) => o[k]);
const set = (o) => chrome.storage.local.set(o);
export async function status(patch) { const s = { ...(await get("status")), ...patch, at: new Date().toISOString() }; await set({ status: s }); return s; }

// ---------- התחברות ל-Clearly ----------
async function authCall(grant, body) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=${grant}`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(/Invalid login/i.test(j.error_description || j.msg || "") ? "המייל או הסיסמה לא נכונים" : "ההתחברות ל-Clearly נכשלה");
  const auth = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000, user: j.user.id, email: j.user.email };
  await set({ auth });
  return auth;
}
export const login = (email, password) => authCall("password", { email, password });
export async function logout() { await chrome.storage.local.remove(["auth", "seen", "status"]); }
async function token() {
  let a = await get("auth"); if (!a) throw new Error("צריך להתחבר ל-Clearly (לחצו על סמל התוסף)");
  if (Date.now() > a.exp) a = await authCall("refresh_token", { refresh_token: a.refresh });
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
async function courseItems(base, sesskey, courseId) {
  try {
    const st = JSON.parse(await ajax(base, sesskey, "core_courseformat_get_state", { courseid: courseId }));
    return (st.cm || []).filter((c) => ["resource", "folder"].includes(c.module) && c.uservisible !== false).map((c) => ({ id: c.id, type: c.module, name: c.name, url: c.url }));
  } catch {
    // גיבוי: קריאה מדף הקורס
    const html = await (await fetch(`${base}/course/view.php?id=${courseId}`, { credentials: "include" })).text();
    const out = [];
    for (const part of html.split('id="module-').slice(1)) {
      const id = +part.match(/^(\d+)/)?.[1], type = part.slice(0, 3000).match(/modtype_(\w+)/)?.[1];
      const name = (part.slice(0, 4000).match(/instancename">([^<]+)/)?.[1] || "").trim();
      if (id && ["resource", "folder"].includes(type)) out.push({ id, type, name, url: `${base}/mod/${type}/view.php?id=${id}` });
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
async function markItem(a, row) {
  await rest("moodle_items", a, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ owner: a.user, ...row }) });
}
async function sha256(blob) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function summarize(a, blob, filename, course, ref) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const r = await fetch(`${SB}/functions/v1/summarize`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${a.access}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filename, mime: blob.type, data: btoa(bin), course, source: "moodle", source_ref: ref }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "failed"), { code: j.error });
  return j;
}

// ---------- בדיקה אחת: מה חדש במודל -> סיכום ----------
let running = false;
export async function syncOnce({ manual = false } = {}) {
  if (running) return get("status");
  running = true;
  try {
    const a = await token();
    let base = await get("moodle");
    if (!base) throw new Error("בחרו את המודל שלכם (לחצו על סמל התוסף)");
    await status({ state: "בודק את המודל…", error: "" });
    base = await resolveBase(base);
    const sesskey = await moodleSession(base);
    const courses = (await ajax(base, sesskey, "core_course_get_enrolled_courses_by_timeline_classification", { classification: "inprogress", limit: 0, offset: 0, sort: "fullname" })).courses || [];
    // מטלות ומועדי הגשה (לאפליקציה), ועבודות שחיכו להגשה מהאפליקציה
    try { await syncAssignments(a, base, sesskey); } catch { /* לא חובה */ }
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
      const r = await rest("moodle_items?select=item_key,status&status=in.(done,skipped)&limit=2000", a);
      if (r.ok) for (const x of await r.json()) if (x.item_key && !seen[x.item_key]) seen[x.item_key] = x.status === "done" ? "done" : "big";
    } catch { /* לא חובה: ממשיכים עם הזיכרון המקומי */ }
    // פעם אחת: קבצים ישנים שבגרסאות קודמות סומנו "ישן" (ולא סוכמו) חוזרים לתור – מסכמים את כל הסמסטר
    if (!(await get("backfill1"))) {
      for (const k of Object.keys(seen)) if (seen[k] === "old") delete seen[k];
      await set({ seen, backfill1: true });
    }
    // כל הקבצים מתחילת הסמסטר, מהחדש לישן, לסירוגין בין הקורסים (כך כל קורס מקבל סיכומים מהר).
    // הקצב מוגבל במכסה היומית בשרת, אז זה נגמר תוך כמה ימים – ממשיכים לבד בכל בדיקה.
    const perCourse = [];
    for (const c of courses) {
      const course = (c.fullname || c.shortname || "").trim();
      if (NOT_COURSE.test(course)) continue;
      const items = await courseItems(base, sesskey, c.id);
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
    let done = 0, made = 0, stop = "";
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
          if (blob.size > 15 * 1024 * 1024) { seen[fkey] = "big"; await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "skipped", note: "גדול מ-15MB" }); continue; }
          const hash = await sha256(blob);
          if (seen["h:" + hash]) { seen[fkey] = "dup"; continue; }   // אותו קובץ כבר סוכם (גם אם הועלה בשם אחר)
          await status({ state: `מסכם: ${it.name}` });
          try {
            await summarize(a, blob, fname, it.course, fkey);
            seen[fkey] = "done"; seen["h:" + hash] = 1; made++;
            await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "done" });
          } catch (e) {
            if (e.code === "limit" || e.code === "global_cap") { seen[fkey] = "retry"; stop = "הגעתם למכסת הסיכומים להיום – נמשיך מחר"; break; }
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
    chrome.action.setBadgeText({ text: made ? String(made) : "" });
    const left = Math.max(backlog - made, 0);
    const more = left ? ` · נשארו עוד כ-${left} קבצים מהסמסטר – ממשיכים לבד (לפי המכסה היומית)` : "";
    await set({ backlogLeft: left });
    return await status({ state: (stop || (made ? `✅ ${made} סיכומים חדשים נשלחו לאפליקציה` : "✅ אין קבצים חדשים")) + more, courses: courses.length, error: "", last: new Date().toISOString() });
  } catch (e) {
    chrome.action.setBadgeText({ text: "!" });
    return await status({ state: "", error: e.message, needMoodle: e.code === "moodle_login" });
  } finally { running = false; }
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
  const a = await token();
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
  return { zoom: zoom.slice(0, 1000), items: items.slice(0, 120) };
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
  const html = await (await fetch(`${base}/mod/assign/view.php?id=${cmid}`, { credentials: "include" })).text();
  // אזור התיאור (id="intro") -> טקסט עם שורות
  let intro = "";
  const m = html.match(/id="intro"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  if (m) intro = m[1].replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h\d|tr)>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "").slice(0, 8000);
  // קבצים מצורפים לתיאור
  const urls = [...new Set([...html.matchAll(/https?:\/\/[^"'\s]+pluginfile\.php\/[^"'\s]*mod_assign\/intro[^"'\s]+/g)].map((x) => x[0].replace(/&amp;/g, "&")))];
  return { intro, urls };
}
// מועדי ההגשה מלוח הזמנים של המודל נשמרים כפריטי מודל מסוג assign, וההערה = מועד ההגשה
async function syncAssignments(a, base, sesskey) {
  const now = Math.floor(Date.now() / 1000);
  const data = await ajax(base, sesskey, "core_calendar_get_action_events_by_timesort", { limitnum: 50, timesortfrom: now - 86400, timesortto: now + 90 * 86400 });
  const seen = (await get("seen")) || {};
  let n = 0;
  for (const ev of data.events || []) {
    if ((ev.modulename || "") !== "assign") continue;
    const cmid = String(ev.url || "").match(/[?&]id=(\d+)/)?.[1]; if (!cmid) continue;
    // ההוראות והקבצים – כדי שאפשר יהיה לפתוח את המטלה בתוך Clearly (גם בטאבלט)
    let intro = "", files = [];
    try {
      const d = await assignDetail(base, cmid);
      intro = d.intro;
      for (const url of d.urls.slice(0, 5)) {
        const fname = decodeURIComponent(url.split("?")[0].split("/").pop() || "קובץ");
        const path = `${a.user}/${cmid}/${fname}`;
        const fkey = `af:${cmid}:${fname}`;
        if (!seen[fkey]) {
          const blob = await (await fetch(url, { credentials: "include" })).blob();
          if (blob.size <= 25 * 1024 * 1024 && await uploadAssignFile(a, path, blob)) { seen[fkey] = "done"; }
        }
        files.push({ name: fname, path });
      }
    } catch { /* אם דף המטלה לא נפתח – לפחות השם והמועד */ }
    await markItem(a, { item_key: `assign:${cmid}`, course: (ev.course?.fullname || "").trim().slice(0, 200), name: String(ev.name || "").slice(0, 300), kind: "assign",
      url: String(ev.url).slice(0, 2000), status: ev.action && ev.action.actionable === false ? "done" : "new", note: new Date(ev.timesort * 1000).toISOString(),
      intro: intro || null, files });
    n++;
  }
  await set({ seen });
  return n;
}
