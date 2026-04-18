# Tasks

- [x] Task 1: Desktop Optimization (Electron)
  - [x] SubTask 1.1: Fix `electron/main.js` to use `ELECTRON_RUN_AS_NODE=1` when spawning server.
  - [x] SubTask 1.2: Implement dynamic port selection in `electron/main.js` and pass port to window.
  - [x] SubTask 1.3: Add Windows build configuration to `package.json`.
- [x] Task 2: Mobile Optimization (Capacitor)
  - [x] SubTask 2.1: Initialize iOS platform (`npx cap add ios`).
  - [x] SubTask 2.2: Implement `SettingsContext` or similar to manage API Base URL in frontend.
  - [x] SubTask 2.3: Create a "Server Connection" settings page in React.
  - [x] SubTask 2.4: Update `client/src/api/client.ts` to use the dynamic Base URL.
- [x] Task 3: Mobile Voice Capture (STT)
  - [x] SubTask 3.1: Add Capacitor speech recognition plugin.
  - [x] SubTask 3.2: Implement SpeechService with web fallback.
  - [x] SubTask 3.3: Integrate into ShisiHome mic button with listening UI.
  - [x] SubTask 3.4: Handle permissions and errors.
- [x] Task 4: Global Voice Recording
  - [x] SubTask 4.1: Implement long-press on BottomNav Mic button.
  - [x] SubTask 4.2: Add slide-up to cancel and visual overlay.
  - [x] SubTask 4.3: Save text as new note via useNotes.
