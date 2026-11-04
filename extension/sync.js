// המחבר של Clearly – הלוגיקה: התחברות ל-Clearly, קריאת הקורסים מהמודל (עם ההתחברות הרגילה של הסטודנט
// בכרום), איתור קבצים חדשים, ושליחתם לסיכום אישי בשרת. לא רואים ולא שומרים את הסיסמה למודל.
export const SB = "https://islplhnlvaukixaglxof.supabase.co";
export const ANON = "sb_publishable_1fDG1GIaFERhcFPiRyx46g_38BIv8HZ";
export const MOODLES = { "אוניברסיטת אריאל": "https://moodlearn.ariel.ac.il" };
const FIRST_RUN_MAX = 4;   // בפעם הראשונה: רק הקבצים האחרונים, לא כל הסמסטר
const PER_RUN_MAX = 5;     // בכל בדיקה – עד 5 קבצים חדשים (המכסה היומית בשרת: 10)
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

// ---------- מודל ----------
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
export async function syncOnce() {
  if (running) return get("status");
  running = true;
  try {
    const a = await token();
    const base = await get("moodle");
    if (!base) throw new Error("בחרו את המודל שלכם (לחצו על סמל התוסף)");
    await status({ state: "בודק את המודל…", error: "" });
    const sesskey = await moodleSession(base);
    const courses = (await ajax(base, sesskey, "core_course_get_enrolled_courses_by_timeline_classification", { classification: "inprogress", limit: 0, offset: 0, sort: "fullname" })).courses || [];
    // מטלות ומועדי הגשה (לאפליקציה), ועבודות שחיכו להגשה מהאפליקציה
    try { await syncAssignments(a, base, sesskey); } catch { /* לא חובה */ }
    try { await submitJobs(); } catch { /* ננסה בפעם הבאה */ }
    const seen = (await get("seen")) || {};
    const firstRun = !Object.keys(seen).length;
    const queue = [];
    for (const c of courses) {
      const items = await courseItems(base, sesskey, c.id);
      for (const it of items) {
        const key = `${new URL(base).host}:${it.id}`;
        if (it.type === "resource" && seen[key]) continue;
        queue.push({ ...it, key, course: (c.fullname || c.shortname || "").trim() });
      }
    }
    // בפעם הראשונה: רק הקבצים האחרונים (בסוף כל קורס = הכי חדשים), את השאר מסמנים כ"נראו"
    let todo = queue;
    if (firstRun) {
      todo = queue.filter((q) => q.type === "resource").slice(-FIRST_RUN_MAX);
      for (const q of queue) if (!todo.includes(q)) { seen[q.key] = "old"; }
      await set({ seen });
    }
    let done = 0, made = 0, stop = "";
    for (const it of todo) {
      if (made >= PER_RUN_MAX) break;
      try {
        for (const f of await fileUrls(base, it)) {
          const fname = decodeURIComponent(f.url.split("?")[0].split("/").pop() || it.name);
          const fkey = it.type === "folder" ? `${it.key}:${fname}` : it.key;
          if (seen[fkey] && seen[fkey] !== "retry") continue;
          if (!OK_EXT.test(fname)) { seen[fkey] = "skip"; continue; }
          const res = f.res || (await fetch(f.url, { credentials: "include" }));
          const blob = await res.blob();
          if (blob.size > 15 * 1024 * 1024) { seen[fkey] = "big"; await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "skipped", note: "גדול מ-15MB" }); continue; }
          await status({ state: `מסכם: ${it.name}` });
          try {
            await summarize(a, blob, fname, it.course, fkey);
            seen[fkey] = "done"; made++;
            await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "done" });
          } catch (e) {
            if (e.code === "limit" || e.code === "global_cap") { seen[fkey] = "retry"; stop = "הגעתם למכסת הסיכומים להיום – נמשיך מחר"; break; }
            seen[fkey] = e.code === "unsupported" ? "skip" : "retry";
            await markItem(a, { item_key: fkey, course: it.course, name: fname, kind: it.type, url: it.url, status: "failed", note: String(e.code || e.message).slice(0, 100) });
          }
          if (made >= PER_RUN_MAX) break;
        }
        if (it.type === "resource" && seen[it.key] !== "retry") seen[it.key] = seen[it.key] || "done";
        done++;
      } catch { /* פריט שלא נפתח – ננסה בפעם הבאה */ }
      await set({ seen });
      if (stop) break;
    }
    await set({ seen });
    chrome.action.setBadgeText({ text: made ? String(made) : "" });
    return await status({ state: stop || (made ? `✅ ${made} סיכומים חדשים נשלחו לאפליקציה` : "✅ אין קבצים חדשים"), courses: courses.length, error: "", last: new Date().toISOString() });
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
  const saved = await fetch(new URL(action, base), { method: "POST", credentials: "include", body });
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

// ---------- מטלות מהמודל -> לאפליקציה (גם לטאבלט) ----------
// מועדי ההגשה מלוח הזמנים של המודל נשמרים כפריטי מודל מסוג assign, וההערה = מועד ההגשה
async function syncAssignments(a, base, sesskey) {
  const now = Math.floor(Date.now() / 1000);
  const data = await ajax(base, sesskey, "core_calendar_get_action_events_by_timesort", { limitnum: 50, timesortfrom: now - 86400, timesortto: now + 90 * 86400 });
  let n = 0;
  for (const ev of data.events || []) {
    if ((ev.modulename || "") !== "assign") continue;
    const cmid = String(ev.url || "").match(/[?&]id=(\d+)/)?.[1]; if (!cmid) continue;
    await markItem(a, { item_key: `assign:${cmid}`, course: (ev.course?.fullname || "").trim().slice(0, 200), name: String(ev.name || "").slice(0, 300), kind: "assign",
      url: String(ev.url).slice(0, 2000), status: ev.action && ev.action.actionable === false ? "done" : "new", note: new Date(ev.timesort * 1000).toISOString() });
    n++;
  }
  return n;
}
