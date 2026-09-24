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
const UNIT_POWER_MULTIPLIERS: Record<string, number> = {
  infantry: 1.0,
  cavalry: 1.5,
  artillery: 2.0,
  archers: 1.2,
  heavy_cavalry: 2.2,
  elite_guard: 3.0,
  siege_engine: 2.5,
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
 * Fórmula baseada nos multiplicadores de cada tipo de unidade
 * Aplica bônus de tecnologia se fornecidos
 */
export function calculateArmyBasePower(
  army: Army,
  techBonuses?: {
    infantry: number;
    cavalry: number;
    artillery: number;
  }
): number {
  let totalPower = 0;

  for (const regiment of army.regiments) {
    let multiplier = UNIT_POWER_MULTIPLIERS[regiment.type] || 1.0;
    
    // Aplica bônus de tecnologia se disponível (apenas para unidades originais)
    if (techBonuses) {
      if (regiment.type === 'infantry') {
        multiplier *= (1 + techBonuses.infantry);
      } else if (regiment.type === 'cavalry') {
        multiplier *= (1 + techBonuses.cavalry);
      } else if (regiment.type === 'artillery') {
        multiplier *= (1 + techBonuses.artillery);
      }
    }
    
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
  province: Province,
  techBonuses?: { infantry: number; cavalry: number; artillery: number }
): { totalPower: number; hasTerritorialBonus: boolean; bonusMultiplier: number } {
  const basePower = calculateArmyBasePower(army, techBonuses);
  
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
  currentDate: GameDate,
  attackerTechBonuses?: { infantry: number; cavalry: number; artillery: number },
  defenderTechBonuses?: { infantry: number; cavalry: number; artillery: number }
): CombatResult {
  // Salva estado original dos exércitos
  const attackerOriginal = { ...attacker, regiments: attacker.regiments.map(r => ({ ...r })) };
  const defenderOriginal = { ...defender, regiments: defender.regiments.map(r => ({ ...r })) };

  // Tamanhos originais
  const attackerOriginalSize = calculateArmySize(attackerOriginal);
  const defenderOriginalSize = calculateArmySize(defenderOriginal);

  // Calcula poderes (com bônus de tecnologia se fornecidos)
  const attackerPower = calculateArmyBasePower(attacker, attackerTechBonuses);
  const { totalPower: defenderPower, hasTerritorialBonus } = calculateDefenderTotalPower(defender, province, defenderTechBonuses);

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
 * Resolve uma batalha em grupo: múltiplos defensores contra um atacante
 * Combina forças defensivas e distribui baixas proporcionalmente
 */
export function resolveProvinceBattle(
  attackerArmy: Army,
  provinceId: string,
  armies: Army[],
  province: Province,
  currentDate: GameDate,
  techBonusesByCountry?: Map<string, { infantry: number; cavalry: number; artillery: number }>
): {
  result: CombatResult | null;
  updatedDefenderArmies: Army[];
} {
  // 1. Encontra TODOS os exércitos defensores presentes na província
  const defenderArmies = armies.filter(
    (a) => a.location === provinceId && 
           a.owner !== attackerArmy.owner &&
           a.id !== attackerArmy.id
  );

  if (defenderArmies.length === 0) {
    return { result: null, updatedDefenderArmies: [] };
  }

  // 2. Combina todos os regimentos dos defensores para o cálculo do combate
  const combinedDefenderRegiments = defenderArmies.flatMap((a) => a.regiments);
  
  // Cria um exército defensor combinado (usa o primeiro como referência de dono)
  const combinedDefender: Army = {
    ...defenderArmies[0],
    id: `combined_defender_${Date.now()}`,
    regiments: combinedDefenderRegiments
  };

  console.log(`🛡️ Batalha em grupo: ${defenderArmies.length} exércitos defensores combinados em ${province.name}`);
  console.log(`   Defensores: ${defenderArmies.map(a => `${a.owner}(${calculateArmySize(a)})`).join(', ')}`);
  console.log(`   Força combinada: ${calculateArmySize(combinedDefender)} tropas`);

  // 3. Resolve a batalha contra a força combinada
  const attackerBonuses = techBonusesByCountry?.get(attackerArmy.owner);
  const defenderBonuses = techBonusesByCountry?.get(combinedDefender.owner);
  
  const result = resolveBattle(
    attackerArmy,
    combinedDefender,
    province,
    currentDate,
    attackerBonuses,
    defenderBonuses
  );

  // 4. Distribui as baixas proporcionalmente entre os defensores originais
  const totalDefenderSize = calculateArmySize(combinedDefender);
  const totalDefenderCasualties = result.defenderCasualties;
  
  const updatedDefenderArmies: Army[] = [];

  if (result.winner === 'defender' || totalDefenderCasualties > 0) {
    // Calcula o percentual de perdas
    const lossPercent = totalDefenderSize > 0 ? totalDefenderCasualties / totalDefenderSize : 0;
    
    console.log(`📊 Distribuição de baixas: ${totalDefenderCasualties} perdas (${(lossPercent * 100).toFixed(1)}%)`);

    // Aplica perdas proporcionalmente a cada exército defensor
    for (const defenderArmy of defenderArmies) {
      const armySize = calculateArmySize(defenderArmy);
      const armyCasualties = Math.floor(armySize * lossPercent);
      
      console.log(`   ${defenderArmy.owner}: ${armySize} → ${Math.max(0, armySize - armyCasualties)} tropas`);
      
      // Distribui as perdas dentro do exército
      const updatedArmy = distributeLosses(defenderArmy, armyCasualties);
      
      // Só adiciona se ainda tiver tropas
      if (calculateArmySize(updatedArmy) > 0) {
        updatedDefenderArmies.push({
          ...updatedArmy,
          location: provinceId,
          destination: null,
          path: [],
          targetArmyId: null,
          targetProvinceId: null
        });
      } else {
        console.log(`💀 Exército ${defenderArmy.owner} destruído em ${province.name}`);
      }
    }
  } else {
    // Se não houve perdas (caso raro), mantém todos os defensores
    updatedDefenderArmies.push(...defenderArmies);
  }

  return { result, updatedDefenderArmies };
}

/**
 * Verifica automaticamente combates em todas as províncias
 * Usa batalha em grupo: combina todos os defensores contra o atacante
 */
export function checkAllProvinceCombats(
  armies: Army[],
  provinces: Province[],
  wars: Array<{ attacker: string; defender: string }>,
  currentDate: GameDate,
  techBonusesByCountry?: Map<string, { infantry: number; cavalry: number; artillery: number }>
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

    // Agrupa exércitos por país
    const armiesByCountry = new Map<string, Army[]>();
    for (const army of armiesInProvince) {
      if (!armiesByCountry.has(army.owner)) {
        armiesByCountry.set(army.owner, []);
      }
      armiesByCountry.get(army.owner)!.push(army);
    }

    // Se há apenas um país na província, não há combate
    if (armiesByCountry.size < 2) continue;

    // Determina atacante e defensor(es)
    // Atacante = quem não é dono da província
    const provinceOwner = province.owner;
    let attackerCountry: string | null = null;
    let defenderCountry: string | null = null;

    for (const country of armiesByCountry.keys()) {
      if (country === provinceOwner) {
        defenderCountry = country;
      } else {
        // Verifica se está em guerra com o dono da província
        const isAtWar = wars.some(
          w => (w.attacker === country && w.defender === provinceOwner) ||
               (w.defender === country && w.attacker === provinceOwner)
        );
        
        if (isAtWar) {
          attackerCountry = country;
        }
      }
    }

    // Se não há atacante ou defensor válido, pula
    if (!attackerCountry || !defenderCountry) continue;

    const attackerArmies = armiesByCountry.get(attackerCountry) || [];
    const defenderArmies = armiesByCountry.get(defenderCountry) || [];

    if (attackerArmies.length === 0 || defenderArmies.length === 0) continue;

    // Usa o primeiro exército atacante (poderia ser combinado também se houvesse múltiplos atacantes)
    const mainAttacker = attackerArmies[0];

    console.log(`⚔️ Combate em grupo em ${province.name}: ${attackerCountry} vs ${defenderCountry}`);
    console.log(`   Atacantes: ${attackerArmies.length} exércitos (${calculateArmySize(mainAttacker)} tropas principais)`);
    console.log(`   Defensores: ${defenderArmies.length} exércitos`);

    // Resolve a batalha em grupo
    const { result, updatedDefenderArmies } = resolveProvinceBattle(
      mainAttacker,
      province.id,
      updatedArmies,
      province,
      currentDate,
      techBonusesByCountry
    );

    if (result) {
      battles.push({ result, provinceId: province.id });

      // Remove todos os exércitos envolvidos (atacantes e defensores originais)
      for (const army of attackerArmies) {
        const idx = updatedArmies.findIndex(a => a.id === army.id);
        if (idx !== -1) updatedArmies.splice(idx, 1);
      }
      for (const army of defenderArmies) {
        const idx = updatedArmies.findIndex(a => a.id === army.id);
        if (idx !== -1) updatedArmies.splice(idx, 1);
      }

      // Adiciona o atacante atualizado (se sobreviveu)
      if (result.winner === 'attacker' && result.attacker.regiments.length > 0) {
        updatedArmies.push({
          ...result.attacker,
          location: province.id,
          destination: null,
          path: [],
          targetArmyId: null,
          targetProvinceId: null
        });
        console.log(`🏆 Vencedor: ${attackerCountry} em ${province.name}`);
      }

      // Adiciona os defensores atualizados (se sobreviveram)
      for (const defenderArmy of updatedDefenderArmies) {
        updatedArmies.push(defenderArmy);
      }

      if (result.winner === 'defender' && updatedDefenderArmies.length > 0) {
        console.log(`🏆 Vencedor: ${defenderCountry} em ${province.name}`);
      }
    }
  }

  console.log('⚔️ checkAllProvinceCombats:', battles.length, 'batalhas resolvidas');

  return { armies: updatedArmies, battles };
}
