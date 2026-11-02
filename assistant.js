// 🤖 העוזר: כפתור צף במחברות, בסיכומים ובמבחנים. עונה לפי החומר שלך (הדף הפתוח, או הסיכומים הכי קשורים לשאלה),
// ואם מסמנים "🌐 גם מהאינטרנט" – מחפש גם בגוגל (Gemini, במסלול החינמי).

export function initAssistant(ctx) {
  const { store, esc, ai } = ctx;
  const AREAS = ["summaries", "quizzes", "notebooks"];
  let history = [], ctrl = null;

  // מילים מהשאלה -> הסיכומים שהכי מתאימים (חיפוש פשוט במכשיר)
  async function relevant(question, course) {
    const sums = (await store.listItems()).filter((x) => x.type === "summary" && (!course || x.course === course));
    const words = question.split(/[\s,.?!:;()"']+/).filter((w) => w.length > 2);
    const scored = sums.map((s) => {
      const text = ai.htmlToText(s.html || "");
      return { s, text, score: words.reduce((n, w) => n + (text.split(w).length - 1), 0) + (s.title.includes(question) ? 5 : 0) };
    }).sort((a, b) => b.score - a.score || (b.s.date || "").localeCompare(a.s.date || ""));
    return scored.slice(0, 3);
  }
  // על מה העוזר מסתמך, לפי המסך הפתוח
  async function context(question) {
    let hash = location.hash.slice(1); try { hash = decodeURIComponent(hash); } catch { /* */ }
    if (hash.startsWith("sum-")) {
      const s = await store.getItem(hash.slice(4));
      if (s) return { title: s.title, text: ai.htmlToText(s.html), label: s.title };
    }
    let course = null, extra = "";
    if (hash.startsWith("lesson-")) {
      const l = await store.getLesson(hash.slice(7));
      if (l) { course = l.course; extra = l.text ? `הערות שלי מהשיעור:\n${l.text}\n\n` : ""; }
    } else if (hash.startsWith("quiz-")) {
      const q = await store.getItem(hash.slice(5));
      if (q?.questions) { course = q.course; extra = "שאלות המבחן שאני פותר:\n" + q.questions.map((x, i) => `${i + 1}. ${x.q} | ${x.options.join(" / ")}`).join("\n") + "\n\n"; }
    } else if (hash.startsWith("course-")) {
      course = ctx.prefs.get()?.courses?.[+hash.slice(7)] || null;
    }
    const top = await relevant(question, course);
    const text = (extra + top.map((t) => `### ${t.s.title}\n${t.text}`).join("\n\n")).slice(0, 60000);
    return { title: course || "כל החומר שלי", text: text || "אין עדיין סיכומים במכשיר.", label: top.length ? top.map((t) => t.s.title).join(" · ") : course || "כל החומר" };
  }

  function panel() {
    document.getElementById("aiPanel")?.remove();
    const has = ai.hasAI();
    document.body.insertAdjacentHTML("beforeend", `<section class="ai-panel" id="aiPanel" role="dialog" aria-labelledby="aiPT">
      <div class="row" style="justify-content:space-between"><h2 id="aiPT" style="font-size:20px">🤖 העוזר</h2><button class="tool" id="aiX" aria-label="סגירה">✕</button></div>
      ${has ? `<p class="small muted" id="aiCtx">שואלים על החומר. העוזר עונה לפי הסיכומים שלך.</p>
      <div class="chat-log" id="aiLog" aria-live="polite"></div>
      <label class="row small" style="gap:6px"><input type="checkbox" id="aiWeb" style="width:auto"> 🌐 גם מהאינטרנט (חיפוש בגוגל)</label>
      <form class="chat-form" id="aiForm"><textarea id="aiIn" rows="2" placeholder="למשל: מה ההבדל בין חציון לממוצע?" autocomplete="off"></textarea><button class="btn" id="aiSend">שליחה</button></form>`
      : `<p class="notice">כדי שהעוזר יעבוד, מחברים פעם אחת AI חינמי של גוגל (Gemini). לוקח 2 דקות.</p><a class="btn" href="#settings-ai" id="aiGo">לחיבור</a>`}
    </section>`);
    document.getElementById("aiX").onclick = close;
    document.getElementById("aiGo") && (document.getElementById("aiGo").onclick = close);
    if (!has) return;
    history = [];
    const form = document.getElementById("aiForm"), input = document.getElementById("aiIn");
    input.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (ctrl) { ctrl.abort(); return; }
      const q = input.value.trim(); if (!q) return;
      input.value = "";
      const log = document.getElementById("aiLog");
      log.insertAdjacentHTML("beforeend", `<div class="bubble me">${esc(q)}</div><div class="bubble bot"><span class="typing">חושב…</span></div>`);
      const bot = log.lastElementChild; let text = "";
      ctrl = new AbortController(); document.getElementById("aiSend").textContent = "עצירה";
      try {
        const c = await context(q);
        document.getElementById("aiCtx").textContent = "מבוסס על: " + c.label;
        const full = await ai.ask({ lessonTitle: c.title, lessonText: c.text, history, question: q, web: document.getElementById("aiWeb").checked, signal: ctrl.signal, onText: (t) => { text += t; bot.innerHTML = ai.miniMd(text); log.scrollTop = log.scrollHeight; } });
        history.push({ role: "user", content: q }, { role: "assistant", content: full });
        bot.innerHTML = ai.miniMd(full);
      } catch (err) {
        if (err.code !== "abort") bot.innerHTML = `<span class="err">${esc(err.message)}</span>`;
      } finally { ctrl = null; document.getElementById("aiSend") && (document.getElementById("aiSend").textContent = "שליחה"); }
    };
    input.focus();
  }
  function close() { ctrl?.abort(); document.getElementById("aiPanel")?.remove(); }

  // נקרא אחרי כל מעבר מסך: מציג את הכפתור רק באזורים הרלוונטיים
  function mount(tab) {
    const show = AREAS.includes(tab);
    let fab = document.getElementById("aiFab");
    if (!show) { fab?.remove(); close(); return; }
    if (!fab) {
      document.body.insertAdjacentHTML("beforeend", `<button class="ai-fab" id="aiFab" aria-label="העוזר החכם">🤖</button>`);
      fab = document.getElementById("aiFab");
      fab.onclick = () => (document.getElementById("aiPanel") ? close() : panel());
    }
  }
  return { mount, close };
}
