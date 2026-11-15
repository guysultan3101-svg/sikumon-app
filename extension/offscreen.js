// דף רקע קטן של התוסף. כרום מכבה את "העובד" של התוסף כשתשובה מהשרת לוקחת יותר מ-30 שניות (וסיכום לוקח לפעמים דקה ויותר),
// ודף רגיל לא נכבה. לכן הקריאה הארוכה לשרת הסיכומים נעשית מכאן.
// בנוסף (1.6.14): קריאת הטקסט של כל עמוד ב-PDF, לחיפוש בתוך חומרי הקורס. ל"עובד" אין את הכלים לזה, לדף יש.
import { pdfPages, setWorker } from "./pdftext.js";
setWorker(chrome.runtime.getURL("pdfjs/pdf.worker.min.mjs"));

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.cmd === "longPost") {
    fetch(msg.url, { method: "POST", headers: msg.headers, body: msg.body, signal: AbortSignal.timeout(170000) })
      .then(async (r) => reply({ ok: r.ok, status: r.status, text: await r.text() }))
      .catch((e) => reply({ netError: String(e) }));
    return true;
  }
  if (msg?.cmd === "pdfText") {
    (async () => {
      const bin = atob(msg.data);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return { pages: await pdfPages(u8) };
    })().then(reply, (e) => reply({ error: String(e?.message || e).slice(0, 200) }));
    return true;
  }
});
