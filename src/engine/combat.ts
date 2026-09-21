/**
 * ============================================================
 * MÓDULO 3 - Motor de Combate (REBALANCEADO)
 * ============================================================
 * Resolve batalhas entre exércitos, considerando:
 * - Tamanho dos exércitos (fortemente ponderado)
 * - Composição de unidades (Infantaria/Cavalaria/Artilharia)
 * - Bônus de defesa da província (fortificações)
 * - Sistema de moral com recuo automático
 * - Proporção de forças (ratio de poder)
 */

import { Army, Regiment, Province, CombatResult } from '../types';
import { UNIT_DEFINITIONS } from '../data/units';

/**
 * Constantes de balanceamento do combate (REBALANCEADO)
 */
const COMBAT_BALANCE = {
  /** Dano base por dia de combate (reduzido para ser mais proporcional) */
  BASE_DAMAGE: 0.03,
  /** Multiplicador de vantagem numérica (exército maior causa mais dano) */
  SIZE_ADVANTAGE_MULTIPLIER: 0.15,
  /** Penalidade de moral por baixas (aumentada para recuo mais rápido) */
  MORALE_LOSS_PER_CASUALTY: 0.003,
  /** Moral mínima para continuar lutando */
  MIN_MORALE_TO_FIGHT: 20,
  /** Perda de tropas que força recuo (60%) */
  RETREAT_THRESHOLD: 0.6,
  /** Bônus de defesa por nível de fortificação */
  FORTIFICATION_DEFENSE_BONUS: 0.1,
  /** Perda de moral por dia de combate */
  DAILY_MORALE_LOSS: 3,
  /** Máximo de perda por dia (15% do exército) */
  MAX_DAILY_LOSS_RATIO: 0.15,
  /** Penalidade para exército em desvantagem numérica (1:7 = 2x mais baixas) */
  NUMERICAL_DISADVANTAGE_PENALTY: 2.0,
};

/**
 * Calcula o poder total de um exército (ataque ou defesa)
 * REBALANCEADO: Fortemente ponderado pelo tamanho total de tropas
 */
export function calculateArmyPower(army: Army, type: 'attack' | 'defense'): number {
  let totalPower = 0;
  const totalMen = calculateArmySize(army);

  // Calcula poder base por tipo de unidade
  for (const regiment of army.regiments) {
    const def = UNIT_DEFINITIONS[regiment.type];
    const basePower = type === 'attack' ? def.attack : def.defense;
    
    // Poder é DIRETAMENTE proporcional ao número de homens (não dividido por 1000)
    const regimentPower = basePower * regiment.strength;
    
    // Bônus de moral (50-100 = bônus, 0-50 = penalidade)
    const moraleBonus = 0.5 + (regiment.morale / 100);
    totalPower += regimentPower * moraleBonus;
  }

  // Bônus por tamanho total (exércitos maiores são mais eficientes)
  const sizeBonus = 1 + (totalMen / 10000) * 0.1; // +10% por 10k homens
  
  return totalPower * sizeBonus;
}

/**
 * Calcula o tamanho total de um exército (número de homens)
 * GARANTE retorno de número inteiro
 */
export function calculateArmySize(army: Army): number {
  return Math.floor(army.regiments.reduce((sum, reg) => sum + reg.strength, 0));
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
 * REBALANCEADO: Dano proporcional ao ratio de poder e tamanho
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

  // Calcula tamanhos
  const attackerSize = calculateArmySize(attacker);
  const defenderSize = calculateArmySize(defender);

  // Calcula ratio de poder (quem tem mais poder causa mais dano)
  const totalPower = attackPower + defensePower;
  const attackerRatio = totalPower > 0 ? attackPower / totalPower : 0.5;
  const defenderRatio = totalPower > 0 ? defensePower / totalPower : 0.5;

  // Calcula ratio de tamanho para penalidade de desvantagem numérica
  const sizeRatio = attackerSize / Math.max(defenderSize, 1);
  
  // Penalidade para exército em desvantagem numérica (1:7 = 2x mais baixas)
  let attackerPenalty = 1.0;
  let defenderPenalty = 1.0;
  
  if (sizeRatio < 0.5) {
    // Atacante está em desvantagem (menos da metade do tamanho)
    attackerPenalty = COMBAT_BALANCE.NUMERICAL_DISADVANTAGE_PENALTY * (1 / sizeRatio);
  } else if (sizeRatio > 2) {
    // Defensor está em desvantagem
    defenderPenalty = COMBAT_BALANCE.NUMERICAL_DISADVANTAGE_PENALTY * sizeRatio;
  }

  // Calcula dano base (proporcional ao ratio de poder)
  const baseDamage = (attackPower + defensePower) * COMBAT_BALANCE.BASE_DAMAGE;
  const attackerDamage = baseDamage * attackerRatio * defenderPenalty;
  const defenderDamage = baseDamage * defenderRatio * attackerPenalty;

  // Aplica dano com limite máximo (15% do exército por dia)
  const maxAttackerLoss = attackerSize * COMBAT_BALANCE.MAX_DAILY_LOSS_RATIO;
  const maxDefenderLoss = defenderSize * COMBAT_BALANCE.MAX_DAILY_LOSS_RATIO;

  const attackerLoss = Math.min(Math.floor(defenderDamage), maxAttackerLoss);
  const defenderLoss = Math.min(Math.floor(attackerDamage), maxDefenderLoss);

  // Distribui perdas entre regimentos
  const updatedAttacker = applyLosses(attacker, attackerLoss);
  const updatedDefender = applyLosses(defender, defenderLoss);

  // Reduz moral (mais perda se sofreu mais baixas)
  const attackerMoraleLoss = COMBAT_BALANCE.DAILY_MORALE_LOSS + (attackerLoss / Math.max(attackerSize, 1)) * 10;
  const defenderMoraleLoss = COMBAT_BALANCE.DAILY_MORALE_LOSS + (defenderLoss / Math.max(defenderSize, 1)) * 10;

  const finalAttacker = reduceMorale(updatedAttacker, attackerMoraleLoss);
  const finalDefender = reduceMorale(updatedDefender, defenderMoraleLoss);

  return {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerLoss: Math.floor(attackerLoss),
    defenderLoss: Math.floor(defenderLoss),
  };
}

/**
 * Aplica perdas a um exército, distribuindo entre regimentos
 * GARANTE que todas as perdas sejam números inteiros
 */
function applyLosses(army: Army, totalLoss: number): Army {
  const updatedRegiments = [...army.regiments];
  const armySize = calculateArmySize(army);
  let remainingLoss = Math.floor(totalLoss);

  // Distribui perdas proporcionalmente ao tamanho
  for (let i = 0; i < updatedRegiments.length && remainingLoss > 0; i++) {
    const reg = updatedRegiments[i];
    const proportion = armySize > 0 ? reg.strength / armySize : 0;
    const loss = Math.min(Math.floor(reg.strength), Math.floor(remainingLoss * proportion));
    
    updatedRegiments[i] = {
      ...reg,
      strength: Math.max(0, Math.floor(reg.strength - loss)),
      morale: Math.max(0, reg.morale - loss * COMBAT_BALANCE.MORALE_LOSS_PER_CASUALTY),
    };
    
    remainingLoss -= loss;
  }

  // Remove regimentos destruídos (strength <= 0)
  const survivingRegiments = updatedRegiments.filter(reg => Math.floor(reg.strength) > 0);

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
 * REBALANCEADO: Considera threshold de 60% de perdas para recuo
 */
export function isArmyDefeated(army: Army, originalSize?: number): boolean {
  const currentSize = calculateArmySize(army);
  
  // Sem tropas = derrotado
  if (currentSize <= 0) return true;
  
  // Moral muito baixa = recuo
  const avgMorale = calculateArmyMorale(army);
  if (avgMorale < COMBAT_BALANCE.MIN_MORALE_TO_FIGHT) return true;
  
  // Perdeu mais de 60% do contingente original = recuo forçado
  if (originalSize && originalSize > 0) {
    const lossRatio = 1 - (currentSize / originalSize);
    if (lossRatio >= COMBAT_BALANCE.RETREAT_THRESHOLD) return true;
  }
  
  return false;
}

/**
 * Resolve uma batalha completa até um lado ser derrotado
 * REBALANCEADO: Passa tamanhos originais para verificação de recuo
 */
export function resolveBattle(
  attacker: Army,
  defender: Army,
  province: Province,
  maxDays: number = 30
): CombatResult {
  // Salva estado original dos exércitos
  const attackerOriginal = { ...attacker, regiments: [...attacker.regiments] };
  const defenderOriginal = { ...defender, regiments: [...defender.regiments] };
  
  // Tamanhos originais para verificação de recuo
  const attackerOriginalSize = calculateArmySize(attackerOriginal);
  const defenderOriginalSize = calculateArmySize(defenderOriginal);

  let currentAttacker = { ...attacker };
  let currentDefender = { ...defender };
  let totalAttackerLoss = 0;
  let totalDefenderLoss = 0;
  let days = 0;

  // Combate dia a dia
  while (
    !isArmyDefeated(currentAttacker, attackerOriginalSize) &&
    !isArmyDefeated(currentDefender, defenderOriginalSize) &&
    days < maxDays
  ) {
    const result = resolveCombatDay(currentAttacker, currentDefender, province);
    currentAttacker = result.attacker;
    currentDefender = result.defender;
    totalAttackerLoss += result.attackerLoss;
    totalDefenderLoss += result.defenderLoss;
    days++;
  }

  // Determina vencedor (passa tamanhos originais para verificação de recuo)
  const attackerDefeated = isArmyDefeated(currentAttacker, attackerOriginalSize);
  const defenderDefeated = isArmyDefeated(currentDefender, defenderOriginalSize);

  const winner = defenderDefeated ? 'attacker' : 'defender';

  // Garante que todos os regimentos tenham valores inteiros
  const finalAttacker = {
    ...currentAttacker,
    regiments: currentAttacker.regiments.map(r => ({
      ...r,
      strength: Math.floor(r.strength),
      morale: Math.floor(r.morale),
    })),
  };

  const finalDefender = {
    ...currentDefender,
    regiments: currentDefender.regiments.map(r => ({
      ...r,
      strength: Math.floor(r.strength),
      morale: Math.floor(r.morale),
    })),
  };

  return {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal,
    defenderOriginal,
    attackerCasualties: Math.floor(totalAttackerLoss),
    defenderCasualties: Math.floor(totalDefenderLoss),
    winner,
    provinceId: province.id,
    provinceName: province.name,
    duration: days,
    territoryChanged: false, // Será atualizado pelo App.tsx
  };
}

/**
 * Verifica automaticamente combates em todas as províncias
 * Chamado a cada tick para garantir que exércitos inimigos na mesma província lutem
 */
export function checkAllProvinceCombats(
  armies: Army[],
  provinces: Province[],
  wars: Array<{ attacker: string; defender: string }>
): {
  armies: Army[];
  battles: Array<{
    result: CombatResult;
    provinceId: string;
  }>;
} {
  const updatedArmies = [...armies];
  const battles: Array<{ result: CombatResult; provinceId: string }> = [];

  console.log('⚔️ checkAllProvinceCombats: verificando', provinces.length, 'províncias');

  // Percorre todas as províncias
  for (const province of provinces) {
    // Encontra todos os exércitos nesta província
    const armiesInProvince = updatedArmies.filter(a => a.location === province.id);

    if (armiesInProvince.length < 2) continue; // Precisa de pelo menos 2 exércitos

    // Verifica todos os pares de exércitos
    for (let i = 0; i < armiesInProvince.length; i++) {
      for (let j = i + 1; j < armiesInProvince.length; j++) {
        const army1 = armiesInProvince[i];
        const army2 = armiesInProvince[j];

        // Verifica se estão em guerra
        const areAtWar = wars.some(
          w => (w.attacker === army1.owner && w.defender === army2.owner) ||
               (w.defender === army1.owner && w.attacker === army2.owner)
        );

        if (!areAtWar) continue;

        console.log('⚔️ Combate automático em', province.name, ':', army1.owner, 'vs', army2.owner);

        // Determina quem é atacante e defensor
        // Atacante = quem não é dono da província (ou o primeiro se ambos não são donos)
        let attacker = army1;
        let defender = army2;

        if (army1.owner === province.owner) {
          attacker = army2;
          defender = army1;
        }

        // Resolve o combate
        const result = resolveBattle(attacker, defender, province);

        battles.push({ result, provinceId: province.id });

        // Remove os exércitos originais
        const idx1 = updatedArmies.findIndex(a => a.id === army1.id);
        const idx2 = updatedArmies.findIndex(a => a.id === army2.id);

        if (idx1 !== -1) updatedArmies.splice(idx1, 1);
        if (idx2 !== -1) updatedArmies.splice(idx2 - (idx1 < idx2 ? 1 : 0), 1);

        // Adiciona o vencedor (se sobreviveu)
        if (result.winner === 'attacker' && result.attacker.regiments.length > 0) {
          updatedArmies.push({ ...result.attacker, location: province.id, destination: null, path: [] });
          console.log('🏆 Vencedor:', attacker.owner, 'em', province.name);
        } else if (result.winner === 'defender' && result.defender.regiments.length > 0) {
          updatedArmies.push({ ...result.defender, location: province.id, destination: null, path: [] });
          console.log('🏆 Vencedor:', defender.owner, 'em', province.name);
        }

        // Sai do loop interno pois os exércitos foram processados
        break;
      }
    }
  }

  console.log('⚔️ checkAllProvinceCombats:', battles.length, 'batalhas resolvidas');

  return { armies: updatedArmies, battles };
}
