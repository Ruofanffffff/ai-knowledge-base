import { API_BASE_URL } from './api';
import { coercePersistedSources, normalizeSourceType, type PersistedSource } from '../types/sources';

type AnyObject = Record<string, any>;

export type AiSearchEvent =
  | { type: 'sources'; sources: PersistedSource[]; raw: AnyObject }
  | { type: 'content'; delta: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export type AiSearchRequest = {
  query: string;
  model?: string;
  limit?: number;
  topK?: number;
  messages?: Array<{ role: string; content: string }>;
};

export type AiSearchCallbacks = {
  onEvent?: (ev: AiSearchEvent) => void;
  onContent?: (delta: string) => void;
  onSources?: (sources: PersistedSource[], raw: AnyObject) => void;
};

function getAuthHeader(): string | undefined {
  const token = localStorage.getItem('access_token');
  return token ? `Bearer ${token}` : undefined;
}

function mapSourcesPayloadToPersistedSources(payload: AnyObject): PersistedSource[] {
  const out: PersistedSource[] = [];

  const rawSources = Array.isArray(payload?.sources) ? payload.sources : [];
  for (const s of rawSources) {
    if (!s || typeof s !== 'object') continue;
    const id = String((s as AnyObject).id ?? '');
    const title = String((s as AnyObject).title ?? '');
    if (!id || !title) continue;
    out.push({
      id,
      title,
      preview: typeof (s as AnyObject).preview === 'string' ? (s as AnyObject).preview : undefined,
      sourceType: normalizeSourceType((s as AnyObject).sourceType ?? (s as AnyObject).source_type),
      updatedAt: typeof (s as AnyObject).updatedAt === 'string' ? (s as AnyObject).updatedAt : undefined,
      url: typeof (s as AnyObject).url === 'string' ? (s as AnyObject).url : undefined,
    });
  }

  const rawWebSources = Array.isArray(payload?.webSources) ? payload.webSources : [];
  for (const w of rawWebSources) {
    if (!w || typeof w !== 'object') continue;
    const url = String((w as AnyObject).url ?? '');
    const title = String((w as AnyObject).title ?? url);
    if (!title) continue;
    out.push({
      id: url || title,
      title,
      preview: typeof (w as AnyObject).snippet === 'string' ? (w as AnyObject).snippet : undefined,
      sourceType: 'web',
      updatedAt: undefined,
      url: url || undefined,
    });
  }

  const dedup = new Map<string, PersistedSource>();
  for (const s of out) {
    const key = `${s.sourceType}:${s.id}`;
    if (!dedup.has(key)) dedup.set(key, s);
  }
  return Array.from(dedup.values());
}

function parseSseMessage(block: string): { event?: string; data?: string } {
  const lines = block.split('\n').map(l => l.replace(/\r$/, ''));
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trimStart());
  }
  return { event, data: dataLines.length > 0 ? dataLines.join('\n') : undefined };
}

export const aiSearchService = {
  async search(request: AiSearchRequest, callbacks?: AiSearchCallbacks, signal?: AbortSignal): Promise<{
    content: string;
    sources: PersistedSource[];
    rawSourcesEvent?: AnyObject;
  }> {
    const auth = getAuthHeader();
    const resp = await fetch(`${API_BASE_URL}/ai/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify({
        query: request.query,
        ...(request.model ? { model: request.model } : {}),
        ...(typeof request.limit === 'number' ? { limit: request.limit } : {}),
        ...(typeof request.topK === 'number' ? { topK: request.topK } : {}),
        ...(Array.isArray(request.messages) ? { messages: request.messages } : {}),
      }),
      signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `AI 搜索请求失败（HTTP ${resp.status}）`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error('AI 搜索响应不支持流式读取');

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let finalSources: PersistedSource[] = [];
    let rawSourcesEvent: AnyObject | undefined;

    const emit = (ev: AiSearchEvent) => {
      callbacks?.onEvent?.(ev);
      if (ev.type === 'content') callbacks?.onContent?.(ev.delta);
      if (ev.type === 'sources') callbacks?.onSources?.(ev.sources, ev.raw);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const { event, data } = parseSseMessage(part);
        if (!data) continue;
        if (data === '[DONE]') {
          emit({ type: 'done' });
          continue;
        }

        if (event === 'content') {
          accumulated += data;
          emit({ type: 'content', delta: data });
          continue;
        }

        if (event === 'sources') {
          const raw = (() => {
            try { return JSON.parse(data) as AnyObject; } catch { return { data }; }
          })();
          rawSourcesEvent = raw;
          finalSources = mapSourcesPayloadToPersistedSources(raw);
          emit({ type: 'sources', sources: finalSources, raw });
          continue;
        }

        if (event === 'error') {
          const raw = (() => {
            try { return JSON.parse(data) as AnyObject; } catch { return { error: data }; }
          })();
          const msg = String(raw.error || raw.message || '流式响应错误');
          emit({ type: 'error', error: msg });
          throw new Error(msg);
        }

        if (data.startsWith('{') || data.startsWith('[')) {
          try {
            const obj = JSON.parse(data) as AnyObject;
            const type = String(obj?.type || event || '');

            if (type === 'sources') {
              rawSourcesEvent = obj;
              finalSources = mapSourcesPayloadToPersistedSources(obj);
              emit({ type: 'sources', sources: finalSources, raw: obj });
              continue;
            }

            if (type === 'content') {
              const delta = String(obj?.content ?? '');
              if (delta) {
                accumulated += delta;
                emit({ type: 'content', delta });
              }
              continue;
            }

            if (type === 'error') {
              const msg = String(obj?.error || '流式响应错误');
              emit({ type: 'error', error: msg });
              throw new Error(msg);
            }
          } catch {
          }
        }
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      const { event, data } = parseSseMessage(trailing);
      if (data === '[DONE]') emit({ type: 'done' });
      if (event === 'content' && data) {
        accumulated += data;
        emit({ type: 'content', delta: data });
      }
      if (event === 'sources' && data) {
        const raw = (() => {
          try { return JSON.parse(data) as AnyObject; } catch { return { data }; }
        })();
        rawSourcesEvent = raw;
        finalSources = mapSourcesPayloadToPersistedSources(raw);
        emit({ type: 'sources', sources: finalSources, raw });
      }
    }

    return {
      content: accumulated,
      sources: coercePersistedSources(finalSources),
      rawSourcesEvent,
    };
  },
};
