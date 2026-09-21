/**
 * ============================================================
 * MÓDULO 3 - Definições de Unidades Militares
 * ============================================================
 * Define os tipos de unidades disponíveis para recrutamento.
 */

import { UnitDefinition, UnitType } from '../types';

/**
 * Definições de todos os tipos de unidades militares
 */
export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  infantry: {
    type: 'infantry',
    name: 'Infantaria',
    icon: '🗡️',
    cost: 50,
    manpowerCost: 1000,
    trainingTime: 30,
    attack: 10,
    defense: 12,
    mobility: 1.0,
  },
  cavalry: {
    type: 'cavalry',
    name: 'Cavalaria',
    icon: '🐎',
    cost: 80,
    manpowerCost: 1000,
    trainingTime: 45,
    attack: 15,
    defense: 8,
    mobility: 1.5,
  },
  artillery: {
    type: 'artillery',
    name: 'Artilharia',
    icon: '💣',
    cost: 120,
    manpowerCost: 1000,
    trainingTime: 60,
    attack: 20,
    defense: 5,
    mobility: 0.5,
  },
};

/**
 * Calcula o custo total para recrutar uma unidade
 */
export function getRecruitmentCost(unitType: UnitType): { gold: number; manpower: number; days: number } {
  const def = UNIT_DEFINITIONS[unitType];
  return {
    gold: def.cost,
    manpower: def.manpowerCost,
    days: def.trainingTime,
  };
}
