// דף רקע קטן של התוסף. כרום מכבה את "העובד" של התוסף כשתשובה מהשרת לוקחת יותר מ-30 שניות (וסיכום לוקח לפעמים דקה ויותר),
// ודף רגיל לא נכבה. לכן הקריאה הארוכה לשרת הסיכומים נעשית מכאן.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.cmd !== "longPost") return;
  fetch(msg.url, { method: "POST", headers: msg.headers, body: msg.body, signal: AbortSignal.timeout(170000) })
    .then(async (r) => reply({ ok: r.ok, status: r.status, text: await r.text() }))
    .catch((e) => reply({ netError: String(e) }));
  return true;
});
