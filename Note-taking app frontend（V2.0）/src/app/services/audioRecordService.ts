import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export type AudioChunkEvent = {
  base64: string;
  bytes: number;
  sampleRate: number;
  chunkDurationMs: number;
  encoding: 'pcm16le';
  channels: number;
  timestampMs: number;
};

export type AudioRecordStartOptions = {
  sampleRate?: number;
  chunkDurationMs?: number;
};

export type AudioRecordStartResult = {
  sampleRate: number;
  chunkDurationMs: number;
  encoding: 'pcm16le';
  channels: number;
};

export interface AudioRecordPlugin {
  start(options?: AudioRecordStartOptions): Promise<AudioRecordStartResult>;
  stop(): Promise<void>;
  addListener(eventName: 'audioChunk', listenerFunc: (event: AudioChunkEvent) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const AudioRecord = registerPlugin<AudioRecordPlugin>('AudioRecord');

