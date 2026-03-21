export type PersistedSourceType = 'note' | 'document' | 'attachment' | 'web' | 'unknown';

export interface PersistedSource {
  id: string;
  title: string;
  preview?: string;
  sourceType: PersistedSourceType;
  updatedAt?: string;
  url?: string;
}

export function normalizeSourceType(value: unknown): PersistedSourceType {
  const v = String(value || '').toLowerCase();
  if (v === 'note' || v === 'notes') return 'note';
  if (v === 'document' || v === 'documents' || v === 'doc') return 'document';
  if (v === 'attachment' || v === 'attachments') return 'attachment';
  if (v === 'web' || v === 'websource' || v === 'websources') return 'web';
  return 'unknown';
}

export function coercePersistedSources(value: unknown): PersistedSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((x) => ({
      id: String(x.id ?? ''),
      title: String(x.title ?? ''),
      preview: typeof x.preview === 'string' ? x.preview : undefined,
      sourceType: normalizeSourceType(x.sourceType ?? x.source_type ?? x.type),
      updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : undefined,
      url: typeof x.url === 'string' ? x.url : undefined,
    }))
    .filter((x) => x.id && x.title);
}
