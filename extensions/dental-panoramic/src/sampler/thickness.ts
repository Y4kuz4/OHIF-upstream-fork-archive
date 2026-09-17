import { DEFAULT_THICKNESS_MM } from './curvedMpr';

export const MIN_THICKNESS_MM = 1;
export const MAX_THICKNESS_MM = 40;

let thicknessMm = DEFAULT_THICKNESS_MM;
const listeners = new Set<(mm: number) => void>();

export function clampThicknessMm(mm: number): number {
  if (!Number.isFinite(mm)) {
    return DEFAULT_THICKNESS_MM;
  }
  return Math.max(MIN_THICKNESS_MM, Math.min(MAX_THICKNESS_MM, Math.round(mm)));
}

export function getPanoramicThicknessMm(): number {
  return thicknessMm;
}

export function setPanoramicThicknessMm(mm: number): number {
  const next = clampThicknessMm(mm);
  if (next === thicknessMm) {
    return thicknessMm;
  }
  thicknessMm = next;
  listeners.forEach(listener => listener(thicknessMm));
  return thicknessMm;
}

export function subscribePanoramicThickness(listener: (mm: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
