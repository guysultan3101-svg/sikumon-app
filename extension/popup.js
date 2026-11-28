// החלון של התוסף: התחברות ל-Clearly, בחירת המודל, ובדיקה עכשיו
import { login, logout, MOODLES, moodleRoot, resolveBase, sendPageSample } from "./sync.js";

const $ = (s) => document.querySelector(s);
const get = (k) => chrome.storage.local.get(k).then((o) => o[k]);

async function draw() {
  const auth = await get("auth");
  $("#loginBox").hidden = !!auth; $("#mainBox").hidden = !auth;
  if (!auth) {
    // התנתקנו לבד (ההתחברות השמורה פגה) – מסבירים למה צריך להתחבר שוב
    const msg = ((await get("status")) || {}).relogin || "";
    $("#reloginMsg").textContent = msg; $("#reloginMsg").hidden = !msg;
    return;
  }
  $("#who").textContent = auth.email;
  const cur = (await get("moodle")) || "";
  const opts = { ...MOODLES, "מוסד אחר (להקליד כתובת)": "other" };
  $("#moodle").innerHTML = Object.entries(opts).map(([n, u]) => `<option value="${u}" ${u === cur ? "selected" : ""}>${n}</option>`).join("");
  if (cur && !Object.values(MOODLES).includes(cur)) { $("#moodle").value = "other"; $("#otherUrl").value = cur; }
  $("#otherBox").hidden = $("#moodle").value !== "other";
  const st = (await get("status")) || {};
  $("#state").textContent = st.state || (cur ? "עוד לא נבדק" : "בחרו את המודל שלכם ולחצו שמירה");
  $("#error").textContent = st.error || "";
  $("#portal").textContent = st.portal || "";
  $("#last").textContent = st.last ? `בדיקה אחרונה: ${new Date(st.last).toLocaleString("he-IL")}${st.courses ? ` · ${st.courses} קורסים` : ""}` : "";
}

$("#loginBtn").onclick = async () => {
  try { $("#loginBtn").disabled = true; await login($("#email").value.trim(), $("#pass").value); draw(); }
  catch (e) { alert(e.message); } finally { $("#loginBtn").disabled = false; }
};
$("#moodle").onchange = () => { $("#otherBox").hidden = $("#moodle").value !== "other"; };
$("#saveMoodle").onclick = async () => {
  let url = $("#moodle").value;
  if (url === "other") {
    try { const u = new URL($("#otherUrl").value.trim()); if (!u.hostname.endsWith(".ac.il")) throw 0; url = moodleRoot(u.href); }
    catch { alert("כתובת לא תקינה. צריך כתובת של מוסד אקדמי (נגמרת ב-ac.il)"); return; }
  }
  // רק אם עברו למודל אחר מתחילים מחדש את רשימת הקבצים שנבדקו
  const prev = await get("moodle");
  await chrome.storage.local.set(prev === url ? { moodle: url } : { moodle: url, seen: {} });
  $("#savedMsg").textContent = "✓ נשמר";
  setTimeout(() => { $("#savedMsg").textContent = ""; }, 2500);
  draw();
};
$("#syncBtn").onclick = async () => {
  $("#syncBtn").disabled = true; $("#state").textContent = "בודק… (יכול לקחת כמה דקות)"; $("#error").textContent = "";
  await chrome.runtime.sendMessage("sync"); $("#syncBtn").disabled = false; draw();
};
$("#openMoodle").onclick = async () => { const m = await get("moodle"); if (m) chrome.tabs.create({ url: (await resolveBase(m)) + "/my/" }); };
// שליחת דף למפתח: קודם מראים מה יישלח ומה לא, ורק אחרי "אישור ושליחה" שולחים
$("#sendPage").onclick = () => { $("#sendMsg").textContent = ""; $("#consent").hidden = false; $("#sendPage").hidden = true; };
$("#cancelSend").onclick = () => { $("#consent").hidden = true; $("#sendPage").hidden = false; };
$("#confirmSend").onclick = async () => {
  const msg = $("#sendMsg"); $("#consent").hidden = true; msg.textContent = "שולח…";
  try { await sendPageSample(); msg.textContent = "✓ נשלח. תודה! נעדכן כשיהיה תמיכה במוסד שלך."; }
  catch (e) { msg.textContent = "❌ " + e.message; }
  finally { $("#sendPage").hidden = false; }
};
$("#logoutBtn").onclick = async () => { await logout(); draw(); };
// מעבר לגרסה מהחנות: רק בגרסה שהותקנה מקובץ (לגרסה מהחנות יש update_url), ורק כשהאתר מפרסם קישור לחנות
async function storeOffer() {
  if (chrome.runtime.getManifest().update_url) return;   // כבר מהחנות – מתעדכן לבד
  try {
    const latest = await (await fetch("https://clearlyapp.io/extension/latest.json?x=" + Date.now(), { cache: "no-store" })).json();
    if (!/^https:\/\/chromewebstore\.google\.com\//.test(latest?.store || "")) return;
    // כבר הותקנה גרסה מהחנות (העותק הזה הפסיק לסנכרן) – נשאר רק להסיר את הישן
    if (((await get("status")) || {}).storeTakeover) { $("#storeGo").hidden = true; $("#storeIntro").textContent = "✅ הגרסה מהחנות כבר מותקנת ועובדת. נשאר רק להסיר את הגרסה הישנה הזו."; }
    $("#storeBox").hidden = false;
    $("#storeGo").onclick = () => chrome.tabs.create({ url: latest.store });
    $("#storeRemoveOld").onclick = () => chrome.management.uninstallSelf({ showConfirmDialog: true }, () => void chrome.runtime.lastError);
  } catch { /* בלי אינטרנט – לא מציגים */ }
}
storeOffer();
chrome.storage.onChanged.addListener(draw);
draw();
