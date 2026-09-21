/**
 * ============================================================
 * MÓDULO 3 - Motor de Combate
 * ============================================================
 * Resolve batalhas entre exércitos, considerando:
 * - Tamanho dos exércitos
 * - Bônus de defesa da província (fortificações)
 * - Moral das tropas
 * - Baixas em ambos os lados
 */

import { Army, Regiment, Province, CombatResult } from '../types';
import { UNIT_DEFINITIONS } from '../data/units';

/**
 * Constantes de balanceamento do combate
 */
const COMBAT_BALANCE = {
  /** Dano base por dia de combate */
  BASE_DAMAGE: 0.05,
  /** Multiplicador de dano por diferença de tamanho */
  SIZE_ADVANTAGE_MULTIPLIER: 0.02,
  /** Penalidade de moral por baixas */
  MORALE_LOSS_PER_CASUALTY: 0.001,
  /** Moral mínima para continuar lutando */
  MIN_MORALE_TO_FIGHT: 20,
  /** Bônus de defesa por nível de fortificação */
  FORTIFICATION_DEFENSE_BONUS: 0.1,
  /** Perda de moral por dia de combate */
  DAILY_MORALE_LOSS: 2,
};

/**
 * Calcula o poder total de um exército (ataque ou defesa)
 */
export function calculateArmyPower(army: Army, type: 'attack' | 'defense'): number {
  let totalPower = 0;
  let totalMen = 0;

  for (const regiment of army.regiments) {
    const def = UNIT_DEFINITIONS[regiment.type];
    const power = type === 'attack' ? def.attack : def.defense;
    // Power é proporcional à força do regimento
    const regimentPower = power * (regiment.strength / 1000);
    // Bônus de moral
    const moraleBonus = 1 + (regiment.morale - 50) / 100;
    totalPower += regimentPower * moraleBonus;
    totalMen += regiment.strength;
  }

  return totalPower;
}

/**
 * Calcula o tamanho total de um exército (número de homens)
 */
export function calculateArmySize(army: Army): number {
  return army.regiments.reduce((sum, reg) => sum + reg.strength, 0);
}

/**
 * Calcula a moral média de um exército
 */
export function calculateArmyMorale(army: Army): number {
  if (army.regiments.length === 0) return 0;
  const totalMorale = army.regiments.reduce((sum, reg) => sum + reg.morale, 0);
  return totalMorale / army.regiments.length;
}

/**
 * Resolve um dia de combate entre dois exércitos
 */
export function resolveCombatDay(
  attacker: Army,
  defender: Army,
  province: Province
): { attacker: Army; defender: Army; attackerLoss: number; defenderLoss: number } {
  // Calcula poder de ataque e defesa
  const attackPower = calculateArmyPower(attacker, 'attack');
  let defensePower = calculateArmyPower(defender, 'defense');

  // Bônus de defesa da província (fortificações)
  const fortificationBonus = 1 + (province.defense * COMBAT_BALANCE.FORTIFICATION_DEFENSE_BONUS);
  defensePower *= fortificationBonus;

  // Calcula dano
  const attackerDamage = attackPower * COMBAT_BALANCE.BASE_DAMAGE;
  const defenderDamage = defensePower * COMBAT_BALANCE.BASE_DAMAGE;

  // Aplica dano (cada lado causa baixas ao outro)
  const attackerLoss = Math.min(
    defenderDamage,
    calculateArmySize(attacker) * 0.1 // Máximo 10% de perda por dia
  );
  const defenderLoss = Math.min(
    attackerDamage,
    calculateArmySize(defender) * 0.15 // Defensor pode perder até 15%
  );

  // Distribui perdas entre regimentos
  const updatedAttacker = applyLosses(attacker, attackerLoss);
  const updatedDefender = applyLosses(defender, defenderLoss);

  // Reduz moral
  const finalAttacker = reduceMorale(updatedAttacker, COMBAT_BALANCE.DAILY_MORALE_LOSS);
  const finalDefender = reduceMorale(updatedDefender, COMBAT_BALANCE.DAILY_MORALE_LOSS);

  return {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerLoss,
    defenderLoss,
  };
}

/**
 * Aplica perdas a um exército, distribuindo entre regimentos
 */
function applyLosses(army: Army, totalLoss: number): Army {
  const updatedRegiments = [...army.regiments];
  let remainingLoss = totalLoss;

  // Distribui perdas proporcionalmente ao tamanho
  for (let i = 0; i < updatedRegiments.length && remainingLoss > 0; i++) {
    const reg = updatedRegiments[i];
    const proportion = reg.strength / calculateArmySize(army);
    const loss = Math.min(reg.strength, remainingLoss * proportion);
    
    updatedRegiments[i] = {
      ...reg,
      strength: Math.max(0, reg.strength - loss),
      morale: Math.max(0, reg.morale - loss * COMBAT_BALANCE.MORALE_LOSS_PER_CASUALTY),
    };
    
    remainingLoss -= loss;
  }

  // Remove regimentos destruídos
  const survivingRegiments = updatedRegiments.filter(reg => reg.strength > 0);

  return {
    ...army,
    regiments: survivingRegiments,
  };
}

/**
 * Reduz a moral de todos os regimentos
 */
function reduceMorale(army: Army, amount: number): Army {
  return {
    ...army,
    regiments: army.regiments.map(reg => ({
      ...reg,
      morale: Math.max(0, reg.morale - amount),
    })),
  };
}

/**
 * Verifica se um exército foi derrotado (sem tropas ou moral muito baixa)
 */
export function isArmyDefeated(army: Army): boolean {
  if (army.regiments.length === 0) return true;
  const avgMorale = calculateArmyMorale(army);
  return avgMorale < COMBAT_BALANCE.MIN_MORALE_TO_FIGHT;
}

/**
 * Resolve uma batalha completa até um lado ser derrotado
 */
export function resolveBattle(
  attacker: Army,
  defender: Army,
  province: Province,
  maxDays: number = 30
): CombatResult {
  let currentAttacker = { ...attacker };
  let currentDefender = { ...defender };
  let totalAttackerLoss = 0;
  let totalDefenderLoss = 0;
  let days = 0;

  // Combate dia a dia
  while (
    !isArmyDefeated(currentAttacker) &&
    !isArmyDefeated(currentDefender) &&
    days < maxDays
  ) {
    const result = resolveCombatDay(currentAttacker, currentDefender, province);
    currentAttacker = result.attacker;
    currentDefender = result.defender;
    totalAttackerLoss += result.attackerLoss;
    totalDefenderLoss += result.defenderLoss;
    days++;
  }

  // Determina vencedor
  const attackerDefeated = isArmyDefeated(currentAttacker);
  const defenderDefeated = isArmyDefeated(currentDefender);

  const winner = defenderDefeated ? 'attacker' : 'defender';

  return {
    attacker: currentAttacker,
    defender: currentDefender,
    attackerCasualties: Math.floor(totalAttackerLoss),
    defenderCasualties: Math.floor(totalDefenderLoss),
    winner,
    provinceId: province.id,
  };
}
