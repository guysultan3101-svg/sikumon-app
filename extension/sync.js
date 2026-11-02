// המחבר של סיכומון – הלוגיקה: התחברות לסיכומון, קריאת הקורסים מהמודל (עם ההתחברות הרגילה של הסטודנט
// בכרום), איתור קבצים חדשים, ושליחתם לסיכום אישי בשרת. לא רואים ולא שומרים את הסיסמה למודל.
export const SB = "https://islplhnlvaukixaglxof.supabase.co";
export const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbHBsaG5sdmF1a2l4YWdseG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MzA2OTksImV4cCI6MjEwOTIwNjY5OX0.7-E0x9NmUT1ljh7usGOGQ99bWqiSfXFFP1w4qk_lXys";
export const MOODLES = { "אוניברסיטת אריאל": "https://moodlearn.ariel.ac.il" };
const FIRST_RUN_MAX = 4;   // בפעם הראשונה: רק הקבצים האחרונים, לא כל הסמסטר
const PER_RUN_MAX = 5;     // בכל בדיקה – עד 5 קבצים חדשים (המכסה היומית בשרת: 10)
const OK_EXT = /\.(pdf|pptx|docx)$/i;

const get = (k) => chrome.storage.local.get(k).then((o) => o[k]);
const set = (o) => chrome.storage.local.set(o);
export async function status(patch) { const s = { ...(await get("status")), ...patch, at: new Date().toISOString() }; await set({ status: s }); return s; }

// ---------- התחברות לסיכומון ----------
async function authCall(grant, body) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=${grant}`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(/Invalid login/i.test(j.error_description || j.msg || "") ? "המייל או הסיסמה לא נכונים" : "ההתחברות לסיכומון נכשלה");
  const auth = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000, user: j.user.id, email: j.user.email };
  await set({ auth });
  return auth;
}
export const login = (email, password) => authCall("password", { email, password });
export async function logout() { await chrome.storage.local.remove(["auth", "seen", "status"]); }
async function token() {
  let a = await get("auth"); if (!a) throw new Error("צריך להתחבר לסיכומון (לחצו על סמל התוסף)");
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

// ---------- שרת סיכומון ----------
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
