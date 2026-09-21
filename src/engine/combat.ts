/**
 * ============================================================
 * MÓDULO 3 - Motor de Combate (SIMPLIFICADO E PREVISÍVEL)
 * ============================================================
 * Algoritmo direto baseado em dano fixo por unidade e redução proporcional.
 * 
 * REGRA DE OURO: O exército maior recebe dano reduzido proporcionalmente ao ratio de forças.
 * Exemplo: 9.000 vs 1.800 → O exército de 1.800 causa seu dano base,
 * mas esse dano é multiplicado por (1.800/9.000) = 0.2 ao afetar os 9.000.
 */

import { Army, Regiment, Province, CombatResult } from '../types';

/**
 * Taxas de dano fixo por tipo de unidade (baixas/dia por soldado)
 */
const UNIT_DAMAGE_RATES = {
  infantry: 0.03,
  cavalry: 0.05,
  artillery: 0.08,
};

/**
 * Constantes de balanceamento do combate
 */
const COMBAT_BALANCE = {
  /** Penalidade de moral por baixas */
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
};

/**
 * Calcula o dano total causado por um exército por dia
 * NOVA LÓGICA: Dano fixo por tipo de unidade
 */
export function calculateArmyDamage(army: Army): number {
  let totalDamage = 0;

  for (const regiment of army.regiments) {
    const damageRate = UNIT_DAMAGE_RATES[regiment.type];
    const regimentDamage = regiment.strength * damageRate;
    
    // Bônus de moral (50-100 = bônus, 0-50 = penalidade)
    const moraleBonus = 0.5 + (regiment.morale / 100);
    totalDamage += regimentDamage * moraleBonus;
  }

  return totalDamage;
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
 * NOVA LÓGICA: Dano fixo por unidade + redução proporcional para exército maior
 */
export function resolveCombatDay(
  attacker: Army,
  defender: Army,
  province: Province
): { attacker: Army; defender: Army; attackerLoss: number; defenderLoss: number } {
  // Calcula tamanhos
  const attackerSize = calculateArmySize(attacker);
  const defenderSize = calculateArmySize(defender);

  // Calcula dano base causado por cada exército
  let attackerBaseDamage = calculateArmyDamage(attacker);
  let defenderBaseDamage = calculateArmyDamage(defender);

  // Bônus de defesa da província (fortificações) - reduz dano do atacante
  const fortificationBonus = 1 + (province.defense * COMBAT_BALANCE.FORTIFICATION_DEFENSE_BONUS);
  attackerBaseDamage /= fortificationBonus;

  // === REGRA DE OURO: Redução proporcional de dano recebido ===
  // O exército maior recebe dano reduzido proporcionalmente ao ratio de forças
  // Fórmula: danoRecebidoPeloMaior = danoCausadoPeloMenor * (TropasMenor / TropasMaior)
  
  let attackerLoss: number;
  let defenderLoss: number;

  if (attackerSize > defenderSize) {
    // Atacante é maior - recebe dano reduzido
    const ratio = defenderSize / attackerSize;
    attackerLoss = Math.floor(defenderBaseDamage * ratio);
    defenderLoss = Math.floor(attackerBaseDamage);
  } else if (defenderSize > attackerSize) {
    // Defensor é maior - recebe dano reduzido
    const ratio = attackerSize / defenderSize;
    defenderLoss = Math.floor(attackerBaseDamage * ratio);
    attackerLoss = Math.floor(defenderBaseDamage);
  } else {
    // Tamanhos iguais - dano normal
    attackerLoss = Math.floor(defenderBaseDamage);
    defenderLoss = Math.floor(attackerBaseDamage);
  }

  // Aplica limite máximo de perda por dia (15% do exército)
  const maxAttackerLoss = Math.floor(attackerSize * COMBAT_BALANCE.MAX_DAILY_LOSS_RATIO);
  const maxDefenderLoss = Math.floor(defenderSize * COMBAT_BALANCE.MAX_DAILY_LOSS_RATIO);

  attackerLoss = Math.min(attackerLoss, maxAttackerLoss);
  defenderLoss = Math.min(defenderLoss, maxDefenderLoss);

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
