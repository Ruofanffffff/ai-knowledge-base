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
