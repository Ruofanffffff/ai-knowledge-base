import apiClient from '../api/client';

export type TelemetryEvent = {
  name: string;
  ts?: string;
  data?: Record<string, unknown>;
};

export async function reportTelemetryEvent(event: TelemetryEvent): Promise<void> {
  try {
    await apiClient.post(
      '/telemetry/events',
      {
        name: event.name,
        ts: event.ts || new Date().toISOString(),
        data: event.data || {},
      },
      { timeout: 2000 }
    );
  } catch (_) {
    return;
  }
}
