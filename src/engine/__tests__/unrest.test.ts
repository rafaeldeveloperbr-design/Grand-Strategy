import { describe, it, expect } from 'vitest';
import {
  calculateRebelArmySize,
  processDailyUnrestDecay,
  applyConquestUnrest,
  isProvincePacified,
  calculateUnrestEconomicImpact,
  UNREST_BALANCE
} from '../unrest';

const baseProvince = {
  id: 'p1',
  name: 'Porto Alegre',
  population: 10000,
  unrest: 0,
  buildings: [],
  owner: 'BRA',
} as any;

const date = { day: 1, month: 1, year: 1836 } as any;

describe('UNREST', () => {
  it('conquista - aplica 50 de unrest inicial', () => {
    const conquered = applyConquestUnrest(baseProvince, date);
    expect(conquered.unrest!).toBe(50);
  });

  it('crescimento - unrest aumenta 0.3 por dia sem templo', () => {
    const provinces = [{...baseProvince, unrest: 10, buildings: [] }];
    const result = processDailyUnrestDecay(provinces, date, []);
    expect(result.updatedProvinces[0].unrest!).toBeCloseTo(10.3, 1);
  });

  it('pacificação - templo reduz unrest', () => {
    const noTemple = processDailyUnrestDecay([{...baseProvince, unrest: 20, buildings: [] }], date, []);
    const withTemple = processDailyUnrestDecay([{...baseProvince, unrest: 20, buildings: [{ type: 'temple', level: 1, daysRemaining: 0 }] } as any], date, []);
    expect(withTemple.updatedProvinces[0].unrest!).toBeLessThan(noTemple.updatedProvinces[0].unrest!);
  });

  it('pacificação - guarnição reduz unrest', () => {
    const armies = [{ location: 'p1', owner: 'BRA', inCombat: false } as any];
    const noGarrison = processDailyUnrestDecay([{...baseProvince, unrest: 20 }], date, []);
    const withGarrison = processDailyUnrestDecay([{...baseProvince, unrest: 20 }], date, armies);
    expect(withGarrison.updatedProvinces[0].unrest!).toBeLessThan(noGarrison.updatedProvinces[0].unrest!);
  });

  it('revolta - unrest 100 gera revolta e reseta para 30', () => {
    const provinces = [{...baseProvince, unrest: 99.9 }];
    const result = processDailyUnrestDecay(provinces, date, []);
    expect(result.revoltedProvinces.length).toBe(1);
    expect(result.updatedProvinces[0].unrest!).toBe(30);
  });

  it('tamanho rebelde - limitado a 3000', () => {
    const small = calculateRebelArmySize({...baseProvince, population: 1000 } as any);
    const big = calculateRebelArmySize({...baseProvince, population: 100000 } as any);
    expect(big).toBeGreaterThanOrEqual(small);
    expect(big).toBeLessThanOrEqual(UNREST_BALANCE.MAX_REBEL_SIZE);
    expect(small).toBeGreaterThanOrEqual(UNREST_BALANCE.MIN_REBEL_SIZE);
  });

  it('econômico - unrest 100 penaliza 50% ouro', () => {
    const high = calculateUnrestEconomicImpact(100);
    expect(high.goldMultiplier).toBe(0.5);
    expect(high.manpowerMultiplier).toBe(0.7);
  });

  it('pacificada - unrest 0 é pacificada', () => {
    expect(isProvincePacified({...baseProvince, unrest: 0 } as any)).toBe(true);
    expect(isProvincePacified({...baseProvince, unrest: 10 } as any)).toBe(false);
  });
});