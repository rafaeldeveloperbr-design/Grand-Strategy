import { describe, it, expect } from 'vitest';
import {
  calculateProvinceGoldIncome,
  calculatePopulationGrowth,
  calculateCountryExpenses,
  processDailyTick,
  calculateProvinceManpowerGain
} from '../economy';
import { processConstructions } from '../buildings';

const baseProvince = {
  id: 'p1',
  owner: 'BRA',
  population: 10000,
  maxPopulation: 50000,
  development: 1,
  unrest: 0,
  buildings: [],
} as any;

const baseCountry = {
  tag: 'BRA',
  provinces: ['p1'],
  resources: { gold: 100, manpower: 500, maxManpower: 10000, stability: 60 },
  activeLaws: {},
} as any;

describe('ECONOMIA', () => {
  it('renda - população maior gera mais ouro', () => {
    const small = calculateProvinceGoldIncome({...baseProvince, population: 1000 } as any);
    const big = calculateProvinceGoldIncome({...baseProvince, population: 10000 } as any);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeGreaterThan(0);
  });

  it('manutenção - mais províncias = mais despesa', () => {
    const cheap = calculateCountryExpenses({...baseCountry, provinces: ['p1'] } as any, [baseProvince]);
    const expensive = calculateCountryExpenses({...baseCountry, provinces: ['p1','p2','p3'] } as any, [baseProvince, baseProvince, baseProvince]);
    expect(expensive).toBeGreaterThan(cheap);
  });

  it('crescimento - população cresce com estabilidade alta', () => {
    const growthLowStab = calculatePopulationGrowth(baseProvince, 20);
    const growthHighStab = calculatePopulationGrowth(baseProvince, 90);
    expect(growthHighStab).toBeGreaterThan(growthLowStab);
  });

  it('crescimento - trava no maxPopulation', () => {
    const almostFull = {...baseProvince, population: 49900, maxPopulation: 50000 } as any;
    const growth = calculatePopulationGrowth(almostFull, 60);
    expect(almostFull.population + growth).toBeLessThanOrEqual(50000);
  });

  it('manpower - província gera manpower', () => {
    const gain = calculateProvinceManpowerGain(baseProvince);
    expect(gain).toBeGreaterThan(0);
  });

  it('processDailyTick - tick completo não quebra e gera renda', () => {
    const result = processDailyTick(baseCountry, [baseProvince]);
    expect(result.country.resources.gold).toBeDefined();
    expect(result.provinces[0].population).toBeGreaterThanOrEqual(baseProvince.population);
    expect(result.country.economy.goldIncome).toBeGreaterThan(0);
  });

  it('construção - finaliza obra', () => {
    const constructions = [{ id: 'c1', daysRemaining: 0, provinceId: 'p1', buildingType: 'farm' } as any];
    const result = processConstructions(constructions, [baseProvince]);
    expect(result.completedConstructions.length).toBe(1);
  });
});