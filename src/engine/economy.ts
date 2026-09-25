/**
 * ============================================================
 * MÓDULO 2 - Motor Econômico (Game Engine)
 * ============================================================
 * Processa os ticks diários do jogo, atualizando:
 * - Economia (renda/despesas de ouro)
 * - Manpower (ganho/perda)
 * - Crescimento populacional
 * - Construção de edifícios
 * 
 * Este módulo é o coração do loop de tempo do jogo.
 */

import { Province, Country, BuildingType } from '../types';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { LAWS } from '../constants/laws';

/**
 * Constantes de balanceamento do jogo
 */
const BALANCE = {
  /** Imposto base por 1000 de população */
  TAX_PER_POP: 0.08,
  /** Multiplicador de imposto baseado em desenvolvimento */
  DEV_TAX_MULTIPLIER: 0.15,
  /** Manpower base por 1000 de população (fração recrutável) */
  MANPOWER_FRACTION: 0.02,
  /** Taxa de crescimento populacional base (por dia, %) */
  BASE_GROWTH_RATE: 0.002,
  /** Bônus de crescimento por estabilidade (acima de 50) */
  STABILITY_GROWTH_BONUS: 0.001,
  /** Penalidade de crescimento por superpopulação */
  OVERPOPULATION_PENALTY: 0.01,
  /** Custo de manutenção por província */
  MAINTENANCE_PER_PROVINCE: 0.5,
  /** Custo de manutenção por edifício */
  MAINTENANCE_PER_BUILDING: 0.3,
  /** Fração de população que é manpower elegível */
  ELIGIBLE_POP_FRACTION: 0.3,
};

/**
 * Calcula a renda de ouro de uma província
 */
export function calculateProvinceGoldIncome(
  province: Province,
  goldIncomeMultiplier: number = 1.0
): number {
  const devMultiplier = 1 + (province.development - 1) * BALANCE.DEV_TAX_MULTIPLIER;
  let baseIncome = (province.population / 1000) * BALANCE.TAX_PER_POP * devMultiplier;

  // Adiciona bônus de edifícios
  for (const building of province.buildings) {
    if (building.daysRemaining <= 0) {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.bonusPerLevel.goldIncome) {
        baseIncome += def.bonusPerLevel.goldIncome * building.level;
      }
    }
  }

  // Aplica multiplicador de renda (tecnologias/focos)
  return baseIncome * goldIncomeMultiplier;
}

/**
 * Calcula o ganho de manpower de uma província
 */
export function calculateProvinceManpowerGain(province: Province): number {
  let gain = (province.population / 1000) * BALANCE.MANPOWER_FRACTION;

  // Adiciona bônus de edifícios (acampamentos)
  for (const building of province.buildings) {
    if (building.daysRemaining <= 0) {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.bonusPerLevel.manpowerGain) {
        gain += def.bonusPerLevel.manpowerGain * building.level;
      }
    }
  }

  return gain;
}

/**
 * Calcula a defesa total de uma província
 */
export function calculateProvinceDefense(province: Province): number {
  let defense = province.defense;

  // Adiciona bônus de fortificações
  for (const building of province.buildings) {
    if (building.daysRemaining <= 0 && building.type === 'fortification') {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.bonusPerLevel.defense) {
        defense += def.bonusPerLevel.defense * building.level;
      }
    }
  }

  return defense;
}

/**
 * Calcula o crescimento populacional de uma província
 */
export function calculatePopulationGrowth(
  province: Province,
  countryStability: number
): number {
  // Taxa base
  let growthRate = BALANCE.BASE_GROWTH_RATE;

  // Bônus por estabilidade alta
  if (countryStability > 50) {
    growthRate += BALANCE.STABILITY_GROWTH_BONUS * ((countryStability - 50) / 50);
  }

  // Bônus de edifícios (fazendas)
  for (const building of province.buildings) {
    if (building.daysRemaining <= 0) {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.bonusPerLevel.growthBonus) {
        growthRate += (def.bonusPerLevel.growthBonus / 100) * building.level;
      }
    }
  }

  // Penalidade por superpopulação
  const popRatio = province.population / province.maxPopulation;
  if (popRatio > 0.8) {
    growthRate -= BALANCE.OVERPOPULATION_PENALTY * (popRatio - 0.8) * 5;
  }

  // Crescimento absoluto
  const growth = province.population * growthRate;
  
  // Limita pela capacidade máxima
  const newPop = Math.min(province.population + growth, province.maxPopulation);
  return newPop - province.population;
}

/**
 * Calcula o manpower máximo de um país baseado em suas províncias
 */
export function calculateMaxManpower(provinces: Province[]): number {
  const totalPop = provinces.reduce((sum, p) => sum + p.population, 0);
  return Math.floor(totalPop * BALANCE.ELIGIBLE_POP_FRACTION);
}

/**
 * Calcula as despesas de manutenção de um país
 */
export function calculateCountryExpenses(country: Country, provinces: Province[]): number {
  let expenses = country.provinces.length * BALANCE.MAINTENANCE_PER_PROVINCE;

  // Custo de manutenção por edifício
  for (const province of provinces) {
    expenses += province.buildings.length * BALANCE.MAINTENANCE_PER_BUILDING;
  }

  return expenses;
}

/**
 * Processa um tick diário para um país e suas províncias.
 * Retorna as províncias atualizadas e o país atualizado.
 */
export function processDailyTick(
  country: Country,
  provinces: Province[],
  techBonuses?: {
    goldIncomeMultiplier: number;
    manpowerMultiplier: number;
    buildCostMultiplier: number;
    buildTimeMultiplier: number;
  }
): { country: Country; provinces: Province[] } {
  // Calcula economia total do país
  let totalGoldIncome = 0;
  let totalManpowerGain = 0;

  // Obtém bônus das leis ativas
  const conscriptionLaw = LAWS[country.activeLaws?.conscription || 'conscription_peacetime'];
  const taxationLaw = LAWS[country.activeLaws?.taxation || 'taxation_normal'];
  const governanceLaw = LAWS[country.activeLaws?.governance || 'governance_balanced'];

  const lawGoldMultiplier = taxationLaw?.bonuses.goldMultiplier ?? 1.0;
  const lawManpowerMultiplier = conscriptionLaw?.bonuses.manpowerMultiplier ?? 1.0;
  const lawPopGrowthMultiplier = taxationLaw?.bonuses.popGrowthMultiplier ?? 1.0;
  const lawBuildTimeMultiplier = governanceLaw?.bonuses.buildTimeMultiplier ?? 1.0;

  // Combina multiplicadores de tecnologia e leis
  const goldIncomeMultiplier = (techBonuses?.goldIncomeMultiplier ?? 1.0) * lawGoldMultiplier;
  const manpowerMultiplier = (techBonuses?.manpowerMultiplier ?? 1.0) * lawManpowerMultiplier;
  const buildTimeMultiplier = (techBonuses?.buildTimeMultiplier ?? 1.0) * lawBuildTimeMultiplier;

  const updatedProvinces = provinces.map((province) => {
    // Renda desta província (com multiplicadores de tecnologia e leis)
    const goldIncome = calculateProvinceGoldIncome(province, goldIncomeMultiplier);
    totalGoldIncome += goldIncome;

    // Manpower desta província (com multiplicadores de tecnologia e leis)
    const manpowerGain = calculateProvinceManpowerGain(province) * manpowerMultiplier;
    totalManpowerGain += manpowerGain;

    // Crescimento populacional (com multiplicador de leis)
    const basePopGrowth = calculatePopulationGrowth(province, country.resources.stability);
    const popGrowth = basePopGrowth * lawPopGrowthMultiplier;

    // Avança construções (com multiplicadores de tecnologia e leis)
    const updatedBuildings = province.buildings.map((b) => ({
      ...b,
      daysRemaining: Math.max(0, b.daysRemaining - buildTimeMultiplier),
    }));

    return {
      ...province,
      population: Math.floor(province.population + popGrowth),
      buildings: updatedBuildings,
    };
  });

  // Calcula despesas
  const expenses = calculateCountryExpenses(country, updatedProvinces);
  const goldBalance = totalGoldIncome - expenses;

  // Atualiza manpower
  const newManpower = Math.min(
    country.resources.manpower + totalManpowerGain,
    country.resources.maxManpower
  );

  // Recalcula maxManpower com população atualizada
  const newMaxManpower = calculateMaxManpower(updatedProvinces);

  // Atualiza país
  const updatedCountry: Country = {
    ...country,
    resources: {
      ...country.resources,
      gold: Math.max(0, country.resources.gold + goldBalance),
      manpower: Math.floor(newManpower),
      maxManpower: newMaxManpower,
    },
    economy: {
      goldIncome: Math.round(totalGoldIncome * 10) / 10,
      goldExpense: Math.round(expenses * 10) / 10,
      manpowerGain: Math.floor(totalManpowerGain),
      manpowerExpense: 0,
    },
  };

  return { country: updatedCountry, provinces: updatedProvinces };
}
