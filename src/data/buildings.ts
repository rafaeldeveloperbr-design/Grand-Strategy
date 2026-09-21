/**
 * ============================================================
 * MÓDULO 2 - Definições de Edifícios
 * ============================================================
 * Define os templates de todos os edifícios disponíveis no jogo.
 * Cada edifício tem custo, tempo de construção, nível máximo e bônus.
 */

import { BuildingDefinition, BuildingType } from '../types';

/**
 * Definições de todos os edifícios disponíveis.
 * Usado como referência para custos e bônus.
 */
export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  farm: {
    type: 'farm',
    name: 'Fazenda',
    description: 'Aumenta a produção de alimentos e a renda de impostos da província.',
    icon: '🌾',
    baseCost: 200,
    costMultiplier: 1.5,
    baseBuildTime: 30,
    maxLevel: 5,
    bonusPerLevel: {
      goldIncome: 3.5,
      growthBonus: 0.5,
    },
  },
  market: {
    type: 'market',
    name: 'Mercado',
    description: 'Aumenta significativamente a renda comercial da província.',
    icon: '🏪',
    baseCost: 350,
    costMultiplier: 1.6,
    baseBuildTime: 45,
    maxLevel: 5,
    bonusPerLevel: {
      goldIncome: 6.0,
    },
  },
  barracks: {
    type: 'barracks',
    name: 'Acampamento',
    description: 'Treina reservistas e aumenta o manpower disponível.',
    icon: '⚔️',
    baseCost: 300,
    costMultiplier: 1.5,
    baseBuildTime: 40,
    maxLevel: 5,
    bonusPerLevel: {
      manpowerGain: 50,
    },
  },
  fortification: {
    type: 'fortification',
    name: 'Fortificação',
    description: 'Aumenta a defesa da província, dificultando conquistas.',
    icon: '🏰',
    baseCost: 500,
    costMultiplier: 1.8,
    baseBuildTime: 60,
    maxLevel: 5,
    bonusPerLevel: {
      defense: 3,
    },
  },
};

/**
 * Calcula o custo de construção de um edifício em um determinado nível
 */
export function getBuildingCost(type: BuildingType, currentLevel: number): number {
  const def = BUILDING_DEFINITIONS[type];
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
}

/**
 * Calcula o tempo de construção em dias para um determinado nível
 */
export function getBuildingTime(type: BuildingType, currentLevel: number): number {
  const def = BUILDING_DEFINITIONS[type];
  return Math.floor(def.baseBuildTime * (1 + currentLevel * 0.3));
}

/**
 * Verifica se é possível construir um edifício (nível máximo não atingido)
 */
export function canBuildBuilding(
  type: BuildingType,
  currentLevel: number
): boolean {
  const def = BUILDING_DEFINITIONS[type];
  return currentLevel < def.maxLevel;
}
