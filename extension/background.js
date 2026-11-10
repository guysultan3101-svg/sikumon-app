// המחבר של Clearly – רץ ברקע: בודק את המודל כל חצי שעה (וכשכרום נפתח)
import { syncOnce, submitJobs } from "./sync.js";

// הגשות מהאפליקציה נבדקות כל 5 דקות (בדיקה קלה – רק אם יש משהו בתור)
const alarms = () => { chrome.alarms.create("sync", { periodInMinutes: 30, delayInMinutes: 1 }); chrome.alarms.create("jobs", { periodInMinutes: 5, delayInMinutes: 1 }); };
chrome.runtime.onInstalled.addListener(alarms);
chrome.runtime.onStartup.addListener(alarms);
// אחרי ריצה שסיכמה ועוד נשאר בתור (ולא הגענו למכסה): ממשיכים עוד דקה, בלי לחכות חצי שעה
const run = async () => {
  const s = await syncOnce();
  const { backlogLeft } = await chrome.storage.local.get("backlogLeft");
  if (backlogLeft > 0 && !s?.error && !/מכסת/.test(s?.state || "") && /✅ \d+ סיכומים/.test(s?.state || "")) chrome.alarms.create("sync-more", { delayInMinutes: 1 });
};
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "sync" || a.name === "sync-more") run(); if (a.name === "jobs") submitJobs().catch(() => {}); });
// הכפתור "בדיקה עכשיו" בחלון של התוסף
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === "sync") { syncOnce({ manual: true }).then(reply); return true; }
});
