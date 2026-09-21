/**
 * ============================================================
 * MÓDULO 3 - Motor de Combate (MÉTODO DE ATRITO ABSOLUTO)
 * ============================================================
 * Implementação determinística baseada em Poder Diferencial com
 * Bônus de Defesa Territorial.
 * 
 * REGRA PRINCIPAL: O vencedor é determinado pelo poder total.
 * As baixas do vencedor são estritamente limitadas pela diferença
 * de poder (ratio). Quanto maior a vantagem, menores as perdas.
 */

import { Army, Regiment, Province, CombatResult, GameDate } from '../types';

/**
 * Multiplicadores de poder por tipo de unidade
 */
const UNIT_POWER_MULTIPLIERS = {
  infantry: 1.0,
  cavalry: 1.5,
  artillery: 2.0,
};

/**
 * Constantes de balanceamento do combate
 */
const COMBAT_BALANCE = {
  /** Bônus de defesa em território próprio (+25%) */
  TERRITORIAL_DEFENSE_BONUS: 1.25,
  /** Bônus por nível de fortificação (+10% por nível) */
  FORTIFICATION_BONUS_PER_LEVEL: 0.10,
  /** Perda mínima do vencedor (3%) */
  MIN_WINNER_LOSS_PERCENT: 0.03,
  /** Constante para cálculo de perdas do vencedor */
  WINNER_LOSS_CONSTANT: 0.35,
  /** Perda do perdedor - mínimo (50%) */
  LOSER_LOSS_MIN: 0.50,
  /** Perda do perdedor - máximo (70%) */
  LOSER_LOSS_MAX: 0.70,
};

/**
 * Calcula o tamanho total de um exército (número de homens)
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
 * Calcula o poder base de um exército
 * Fórmula: (Infantaria × 1) + (Cavalaria × 1.5) + (Artilharia × 2.0)
 */
export function calculateArmyBasePower(army: Army): number {
  let totalPower = 0;

  for (const regiment of army.regiments) {
    const multiplier = UNIT_POWER_MULTIPLIERS[regiment.type];
    const regimentPower = regiment.strength * multiplier;
    
    // Bônus de moral (50-100 = bônus, 0-50 = penalidade)
    const moraleBonus = 0.5 + (regiment.morale / 100);
    totalPower += regimentPower * moraleBonus;
  }

  return totalPower;
}

/**
 * Calcula o poder total do defensor com bônus territoriais
 */
export function calculateDefenderTotalPower(
  army: Army,
  province: Province
): { totalPower: number; hasTerritorialBonus: boolean; bonusMultiplier: number } {
  const basePower = calculateArmyBasePower(army);
  
  let bonusMultiplier = 1.0;
  let hasTerritorialBonus = false;

  // Bônus de defesa em território próprio
  if (province.owner === army.owner) {
    bonusMultiplier *= COMBAT_BALANCE.TERRITORIAL_DEFENSE_BONUS;
    hasTerritorialBonus = true;
  }

  // Bônus por fortificação
  if (province.defense > 0) {
    const fortificationBonus = 1 + (province.defense * COMBAT_BALANCE.FORTIFICATION_BONUS_PER_LEVEL);
    bonusMultiplier *= fortificationBonus;
    hasTerritorialBonus = true;
  }

  const totalPower = basePower * bonusMultiplier;

  return { totalPower, hasTerritorialBonus, bonusMultiplier };
}

/**
 * Calcula as perdas do vencedor baseado no ratio de poder
 * Fórmula: percentualPerdas = max(3%, 35% / ratio)
 */
function calculateWinnerLossPercent(powerRatio: number): number {
  const lossPercent = COMBAT_BALANCE.WINNER_LOSS_CONSTANT / powerRatio;
  return Math.max(COMBAT_BALANCE.MIN_WINNER_LOSS_PERCENT, lossPercent);
}

/**
 * Distribui perdas proporcionalmente entre os regimentos
 */
function distributeLosses(army: Army, totalLoss: number): Army {
  const updatedRegiments = [...army.regiments];
  const armySize = calculateArmySize(army);
  let remainingLoss = Math.floor(totalLoss);

  // Distribui perdas proporcionalmente ao tamanho de cada regimento
  for (let i = 0; i < updatedRegiments.length && remainingLoss > 0; i++) {
    const reg = updatedRegiments[i];
    const proportion = armySize > 0 ? reg.strength / armySize : 0;
    const loss = Math.min(Math.floor(reg.strength), Math.floor(remainingLoss * proportion));
    
    updatedRegiments[i] = {
      ...reg,
      strength: Math.max(0, Math.floor(reg.strength - loss)),
      morale: Math.max(0, reg.morale - (loss / Math.max(reg.strength, 1)) * 20),
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
 * Resolve uma batalha completa usando o Método de Atrito Absoluto
 */
export function resolveBattle(
  attacker: Army,
  defender: Army,
  province: Province,
  currentDate: GameDate
): CombatResult {
  // Salva estado original dos exércitos
  const attackerOriginal = { ...attacker, regiments: attacker.regiments.map(r => ({ ...r })) };
  const defenderOriginal = { ...defender, regiments: defender.regiments.map(r => ({ ...r })) };

  // Tamanhos originais
  const attackerOriginalSize = calculateArmySize(attackerOriginal);
  const defenderOriginalSize = calculateArmySize(defenderOriginal);

  // Calcula poderes
  const attackerPower = calculateArmyBasePower(attacker);
  const { totalPower: defenderPower, hasTerritorialBonus } = calculateDefenderTotalPower(defender, province);

  // Determina vencedor e ratio
  const winner: 'attacker' | 'defender' = attackerPower > defenderPower ? 'attacker' : 'defender';
  const winnerPower = Math.max(attackerPower, defenderPower);
  const loserPower = Math.min(attackerPower, defenderPower);
  const powerRatio = loserPower > 0 ? winnerPower / loserPower : 999;

  // Calcula perdas
  let finalAttacker: Army;
  let finalDefender: Army;
  let attackerLoss: number;
  let defenderLoss: number;

  if (winner === 'attacker') {
    // Atacante venceu
    const winnerLossPercent = calculateWinnerLossPercent(powerRatio);
    attackerLoss = Math.floor(attackerOriginalSize * winnerLossPercent);
    
    // Perdedor (defensor) perde 50-70% das tropas
    const loserLossPercent = COMBAT_BALANCE.LOSER_LOSS_MIN + 
      (Math.random() * (COMBAT_BALANCE.LOSER_LOSS_MAX - COMBAT_BALANCE.LOSER_LOSS_MIN));
    defenderLoss = Math.floor(defenderOriginalSize * loserLossPercent);

    finalAttacker = distributeLosses(attacker, attackerLoss);
    finalDefender = distributeLosses(defender, defenderLoss);
  } else {
    // Defensor venceu
    const winnerLossPercent = calculateWinnerLossPercent(powerRatio);
    defenderLoss = Math.floor(defenderOriginalSize * winnerLossPercent);
    
    // Perdedor (atacante) perde 50-70% das tropas
    const loserLossPercent = COMBAT_BALANCE.LOSER_LOSS_MIN + 
      (Math.random() * (COMBAT_BALANCE.LOSER_LOSS_MAX - COMBAT_BALANCE.LOSER_LOSS_MIN));
    attackerLoss = Math.floor(attackerOriginalSize * loserLossPercent);

    finalAttacker = distributeLosses(attacker, attackerLoss);
    finalDefender = distributeLosses(defender, defenderLoss);
  }

  // Garante valores inteiros finais
  finalAttacker = {
    ...finalAttacker,
    regiments: finalAttacker.regiments.map(r => ({
      ...r,
      strength: Math.floor(r.strength),
      morale: Math.floor(r.morale),
    })),
  };

  finalDefender = {
    ...finalDefender,
    regiments: finalDefender.regiments.map(r => ({
      ...r,
      strength: Math.floor(r.strength),
      morale: Math.floor(r.morale),
    })),
  };

  // Calcula baixas EXATAS: TropasIniciais - TropasFinais
  const finalAttackerSize = calculateArmySize(finalAttacker);
  const finalDefenderSize = calculateArmySize(finalDefender);
  
  const exactAttackerCasualties = Math.floor(attackerOriginalSize - finalAttackerSize);
  const exactDefenderCasualties = Math.floor(defenderOriginalSize - finalDefenderSize);

  return {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal,
    defenderOriginal,
    attackerCasualties: exactAttackerCasualties,
    defenderCasualties: exactDefenderCasualties,
    winner,
    provinceId: province.id,
    provinceName: province.name,
    duration: 1, // Combate instantâneo neste método
    territoryChanged: false, // Será atualizado pelo App.tsx
    territorialDefenseBonus: hasTerritorialBonus,
    powerRatio: Math.round(powerRatio * 100) / 100, // 2 casas decimais
    date: currentDate,
  };
}

/**
 * Verifica automaticamente combates em todas as províncias
 */
export function checkAllProvinceCombats(
  armies: Army[],
  provinces: Province[],
  wars: Array<{ attacker: string; defender: string }>,
  currentDate: GameDate
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

        // Determina atacante e defensor
        // Atacante = quem não é dono da província (ou o primeiro se ambos não são donos)
        let attacker = army1;
        let defender = army2;

        if (army1.owner === province.owner) {
          attacker = army2;
          defender = army1;
        }

        // Resolve o combate
        const result = resolveBattle(attacker, defender, province, currentDate);

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
