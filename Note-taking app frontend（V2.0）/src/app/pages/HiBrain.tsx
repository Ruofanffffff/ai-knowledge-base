import { HiBrainClassic } from './HiBrainClassic';
import { HiBrainNewDesign } from './hibrain/HiBrainNewDesign';

// ─────────────────────────────────────────────────────────────────────────────
// HiBrain wrapper — checks rollback mode
// ─────────────────────────────────────────────────────────────────────────────

export function HiBrain() {
  const isClassic = localStorage.getItem('hi_brain_classic') === '1';
  return isClassic ? <HiBrainClassic /> : <HiBrainNewDesign />;
}
