// המחבר של סיכומון – רץ ברקע: בודק את המודל כל 3 שעות (וכשכרום נפתח)
import { syncOnce, submitJobs } from "./sync.js";

// הגשות מהאפליקציה נבדקות כל 5 דקות (בדיקה קלה – רק אם יש משהו בתור)
const alarms = () => { chrome.alarms.create("sync", { periodInMinutes: 180, delayInMinutes: 1 }); chrome.alarms.create("jobs", { periodInMinutes: 5, delayInMinutes: 1 }); };
chrome.runtime.onInstalled.addListener(alarms);
chrome.runtime.onStartup.addListener(alarms);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "sync") syncOnce(); if (a.name === "jobs") submitJobs().catch(() => {}); });
// הכפתור "בדיקה עכשיו" בחלון של התוסף
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === "sync") { syncOnce().then(reply); return true; }
});
