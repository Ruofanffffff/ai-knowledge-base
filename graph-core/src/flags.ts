export type FeatureFlagKey =
  | 'ff_sichain_unified_doc_default'
  | 'ff_sichain_note_tab_enabled'
  | 'ff_graph_dto_v1';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  ff_sichain_unified_doc_default: true,
  ff_sichain_note_tab_enabled: true,
  ff_graph_dto_v1: true,
};

export type FlagStorage = {
  getItem: (key: string) => string | null;
};

function parseBool(raw: string | null): boolean | null {
  if (raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

export function getFeatureFlag(storage: FlagStorage | null | undefined, key: FeatureFlagKey): boolean {
  if (!storage) return DEFAULT_FEATURE_FLAGS[key];
  const raw = storage.getItem(key);
  const parsed = parseBool(raw);
  return parsed === null ? DEFAULT_FEATURE_FLAGS[key] : parsed;
}

export function resolveFeatureFlags(storage: FlagStorage | null | undefined): FeatureFlags {
  return {
    ff_sichain_unified_doc_default: getFeatureFlag(storage, 'ff_sichain_unified_doc_default'),
    ff_sichain_note_tab_enabled: getFeatureFlag(storage, 'ff_sichain_note_tab_enabled'),
    ff_graph_dto_v1: getFeatureFlag(storage, 'ff_graph_dto_v1'),
  };
}
