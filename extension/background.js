// המחבר של סיכומון – רץ ברקע: בודק את המודל כל 3 שעות (וכשכרום נפתח)
import { syncOnce } from "./sync.js";

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("sync", { periodInMinutes: 180, delayInMinutes: 1 }));
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create("sync", { periodInMinutes: 180, delayInMinutes: 2 }); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "sync") syncOnce(); });
// הכפתור "בדיקה עכשיו" בחלון של התוסף
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === "sync") { syncOnce().then(reply); return true; }
});
