
  # Note-taking app frontend

  This is a code bundle for Note-taking app frontend. The original project is available at https://www.figma.com/design/RhCVFGeyftNRILrrx0CeA9/Note-taking-app-frontend.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## AudioRecord Capacitor 插件（iOS/Android）

  JS/TS 侧封装位于 `src/app/services/audioRecordService.ts`，事件 `audioChunk` 每 800ms 推送一段 16kHz PCM16LE mono（Base64）。

  ```ts
  import { AudioRecord } from './src/app/services/audioRecordService';

  let handle: any;

  export async function startRecording() {
    handle = await AudioRecord.addListener('audioChunk', (ev) => {
      const pcmBytes = Uint8Array.from(atob(ev.base64), (c) => c.charCodeAt(0));
      console.log('chunk', ev.sampleRate, ev.bytes, pcmBytes.length);
    });

    await AudioRecord.start({ sampleRate: 16000, chunkDurationMs: 800 });
  }

  export async function stopRecording() {
    try {
      await AudioRecord.stop();
    } finally {
      await handle?.remove?.();
      handle = null;
      await AudioRecord.removeAllListeners();
    }
  }
  ```
  
