export const GAME_DURATION = 60;
export const ROAD_HALF_WIDTH_START = 3.7;
export const ROAD_HALF_WIDTH_END = 2.45;

export type GamePhase = 'ready' | 'playing' | 'paused' | 'falling' | 'won' | 'lost';
export type Stage = 'CITY' | 'NATURE' | 'FUTURE';

export function stageAt(elapsed: number): Stage {
  if (elapsed < 25) return 'CITY';
  if (elapsed < 40) return 'NATURE';
  return 'FUTURE';
}

export function roadHalfWidth(elapsed: number): number {
  const progress = Math.max(0, Math.min(1, elapsed / GAME_DURATION));
  return ROAD_HALF_WIDTH_START + (ROAD_HALF_WIDTH_END - ROAD_HALF_WIDTH_START) * progress;
}

export function roadCenterAt(distance: number, elapsed: number): number {
  const intensity = 0.65 + Math.min(1, elapsed / GAME_DURATION) * 0.85;
  return Math.sin(distance * 0.0018 + elapsed * 0.19) * intensity + Math.sin(distance * 0.00073 - elapsed * 0.11) * intensity * 0.52;
}

export function advanceElapsed(elapsed: number, delta: number): { elapsed: number; cleared: boolean } {
  const next = Math.min(GAME_DURATION, elapsed + Math.max(0, delta));
  return { elapsed: next, cleared: next >= GAME_DURATION };
}

export function isOnRoad(lateralOffset: number, width: number, margin = 0.48): boolean {
  return Math.abs(lateralOffset) <= width - margin;
}

export function isNearMiss(lateralOffset: number, width: number, margin = 0.48, window = 0.42): boolean {
  const edgeDistance = width - margin - Math.abs(lateralOffset);
  return edgeDistance > 0 && edgeDistance <= window;
}

export function isRoadReachable(offset: number, maxShift: number, requiredCenter: number, halfWidth: number): boolean {
  return Math.abs(requiredCenter - offset) < maxShift + halfWidth;
}
