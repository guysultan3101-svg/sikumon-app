# Sikumon AI – test app (Phase 1)

A Hebrew, iPad-first web app (PWA) for a market test: students record a lesson inside the app, then see a sample summary with a formula sheet and a short quiz, and send feedback.

**Status:** prototype. Recordings are saved only on the device (IndexedDB, a chunk every minute). Summaries and quizzes are sample content; AI summaries come in the next version.

## Files
- `index.html`, `styles.css` – app shell and design
- `app.js` – screens (onboarding, record, recordings, summary, quiz, feedback, profile)
- `recorder.js` – recording engine (MediaRecorder, wake lock, interruption handling)
- `demo-data.js` – sample summary, quiz and onboarding questions
- `sw.js`, `manifest.webmanifest`, `icons/` – install to home screen

## Run locally
`python -m http.server 8765` in this folder, then open http://localhost:8765. The microphone needs https or localhost.
