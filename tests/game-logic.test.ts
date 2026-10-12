import { describe, expect, it } from 'vitest';
import { advanceElapsed, isNearMiss, isOnRoad, isRoadReachable, roadCenterAt, roadHalfWidth, stageAt } from '../src/game-logic';

describe('ROAD DRIVER rules', () => {
  it('switches CITY, NATURE, FUTURE at the specified times', () => {
    expect(stageAt(0)).toBe('CITY');
    expect(stageAt(24.99)).toBe('CITY');
    expect(stageAt(25)).toBe('NATURE');
    expect(stageAt(40)).toBe('FUTURE');
  });

  it('narrows the road gradually over sixty seconds', () => {
    expect(roadHalfWidth(0)).toBeGreaterThan(roadHalfWidth(30));
    expect(roadHalfWidth(60)).toBeCloseTo(2.45);
  });

  it('detects safe travel, edge recovery, and falling', () => {
    expect(isOnRoad(0, 3.4)).toBe(true);
    expect(isNearMiss(2.65, 3.4)).toBe(true);
    expect(isOnRoad(3.2, 3.4)).toBe(false);
    expect(isRoadReachable(0, 1.4, 2, 2.4)).toBe(true);
  });

  it('clears at sixty seconds and clamps elapsed time at the finish', () => {
    expect(advanceElapsed(59.6, .4)).toEqual({ elapsed: 60, cleared: true });
    expect(advanceElapsed(60, 3)).toEqual({ elapsed: 60, cleared: true });
    expect(advanceElapsed(12, -1)).toEqual({ elapsed: 12, cleared: false });
  });

  it('keeps every generated curve within the reachable road-shift range', () => {
    for (let elapsed = 0; elapsed <= 60; elapsed += 1) {
      for (let distance = 0; distance <= 100_000; distance += 317) {
        expect(isRoadReachable(0, 4.8, roadCenterAt(distance, elapsed), roadHalfWidth(elapsed))).toBe(true);
      }
    }
  });
});
