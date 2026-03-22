import { resolveFeatureFlags } from 'graph-core';

export function getFeatureFlags() {
  return resolveFeatureFlags(typeof localStorage === 'undefined' ? null : localStorage);
}
