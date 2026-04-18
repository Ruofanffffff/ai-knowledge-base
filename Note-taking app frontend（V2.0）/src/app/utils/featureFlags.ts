function isDisabledFlagValue(v: unknown) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s === '0' || s === 'false' || s === 'off' || s === 'no';
}

export function isWikiEnabled() {
  const raw = (import.meta as any)?.env?.VITE_WIKI_ENABLED;
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'boolean') return raw;
  if (String(raw).trim() === '') return true;
  return !isDisabledFlagValue(raw);
}
