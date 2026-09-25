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

import { Army, Regiment, Province, CombatResult, GameDate, ActiveBattle } from '../types';

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
  /** Tropas por dia de batalha (1000 tropas = 1 dia) */
  TROOPS_PER_BATTLE_DAY: 1000,
  /** Perda do vencedor - mínimo (10%) */
  WINNER_LOSS_MIN: 0.10,
  /** Perda do vencedor - máximo (30%) */
  WINNER_LOSS_MAX: 0.30,
  /** Perda do perdedor - mínimo (30%) */
  LOSER_LOSS_MIN: 0.30,
  /** Perda do perdedor - máximo (60%) */
  LOSER_LOSS_MAX: 0.60,
  /** Perda total em caso de cerco (100%) */
  SIEGE_LOSS_PERCENT: 1.0,
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
 * Calcula a duração da batalha em dias baseado no total de tropas
 * Fórmula: (Tropas do Atacante + Tropas do Defensor) / 2000
 * Mínimo: 1 dia
 */
function calculateBattleDuration(attackerSize: number, defenderSize: number): number {
  const totalTroops = attackerSize + defenderSize;
  return Math.max(1, Math.ceil(totalTroops / COMBAT_BALANCE.TROOPS_PER_BATTLE_DAY));
}

/**
 * Calcula as perdas do vencedor baseado na duração da batalha
 * Vencedor perde entre 10% e 30% das tropas
 */
function calculateWinnerLosses(winnerSize: number, battleDays: number): number {
  // Perdas aumentam com a duração da batalha
  const lossPercent = COMBAT_BALANCE.WINNER_LOSS_MIN + 
    ((COMBAT_BALANCE.WINNER_LOSS_MAX - COMBAT_BALANCE.WINNER_LOSS_MIN) * (battleDays / 10));
  const cappedLossPercent = Math.min(lossPercent, COMBAT_BALANCE.WINNER_LOSS_MAX);
  return Math.floor(winnerSize * cappedLossPercent);
}

/**
 * Calcula as perdas do perdedor baseado na duração da batalha
 * Perdedor perde entre 30% e 60% das tropas
 */
function calculateLoserLosses(loserSize: number, battleDays: number): number {
  // Perdas aumentam com a duração da batalha
  const lossPercent = COMBAT_BALANCE.LOSER_LOSS_MIN + 
    ((COMBAT_BALANCE.LOSER_LOSS_MAX - COMBAT_BALANCE.LOSER_LOSS_MIN) * (battleDays / 10));
  const cappedLossPercent = Math.min(lossPercent, COMBAT_BALANCE.LOSER_LOSS_MAX);
  return Math.floor(loserSize * cappedLossPercent);
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
 * Resolve uma batalha completa usando o Sistema de Combate Prolongado
 * Duração baseada no total de tropas, com recuo tático e regra de cerco
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

  // Calcula duração da batalha baseada no total de tropas
  const battleDays = calculateBattleDuration(attackerOriginalSize, defenderOriginalSize);

  // Calcula poderes (com bônus de tecnologia se fornecidos)
  const attackerPower = calculateArmyBasePower(attacker, attackerTechBonuses);
  const { totalPower: defenderPower, hasTerritorialBonus } = calculateDefenderTotalPower(defender, province, defenderTechBonuses);

  // Determina vencedor e ratio
  const winner: 'attacker' | 'defender' = attackerPower > defenderPower ? 'attacker' : 'defender';
  const winnerPower = Math.max(attackerPower, defenderPower);
  const loserPower = Math.min(attackerPower, defenderPower);
  const powerRatio = loserPower > 0 ? winnerPower / loserPower : 999;

  // Calcula perdas baseadas na duração da batalha
  let finalAttacker: Army;
  let finalDefender: Army;
  let attackerLoss: number;
  let defenderLoss: number;

  if (winner === 'attacker') {
    // Atacante venceu
    attackerLoss = calculateWinnerLosses(attackerOriginalSize, battleDays);
    defenderLoss = calculateLoserLosses(defenderOriginalSize, battleDays);

    finalAttacker = distributeLosses(attacker, attackerLoss);
    finalDefender = distributeLosses(defender, defenderLoss);
  } else {
    // Defensor venceu
    defenderLoss = calculateWinnerLosses(defenderOriginalSize, battleDays);
    attackerLoss = calculateLoserLosses(attackerOriginalSize, battleDays);

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

  console.log(`⚔️ Batalha em ${province.name}: ${battleDays} dias de combate`);
  console.log(`   Atacante: ${attackerOriginalSize} → ${finalAttackerSize} tropas (${exactAttackerCasualties} baixas)`);
  console.log(`   Defensor: ${defenderOriginalSize} → ${finalDefenderSize} tropas (${exactDefenderCasualties} baixas)`);
  console.log(`   Vencedor: ${winner === 'attacker' ? 'Atacante' : 'Defensor'} (ratio: ${powerRatio.toFixed(2)})`);

  // Aplica regra de cerco/aniquilação para o perdedor
  const loser = winner === 'attacker' ? finalDefender : finalAttacker;
  const loserOwner = winner === 'attacker' ? defender.owner : attacker.owner;
  
  // Verifica se o perdedor está cercado (sem províncias próprias vizinhas)
  const hasEscapeRoute = province.neighbors.some(neighborId => {
    const neighborProvince = province.neighbors.includes(neighborId);
    // Precisamos acessar o array de províncias, mas não temos aqui
    // Esta lógica será movida para uma função separada
    return false; // Placeholder - será implementado na função de recuo
  });

  // Se não houver rota de fuga, aplica aniquilação total (100% de baixas)
  // Esta lógica será aplicada no App.tsx onde temos acesso ao array de províncias

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
    duration: battleDays, // Duração calculada baseada nas tropas
    territoryChanged: false, // Será atualizado pelo App.tsx
    territorialDefenseBonus: hasTerritorialBonus,
    powerRatio: Math.round(powerRatio * 100) / 100, // 2 casas decimais
    date: currentDate,
  };
}

/**
 * Verifica se um exército perdedor tem rota de fuga para províncias próprias
 * Retorna a província de recuo ou null se estiver cercado
 */
export function findRetreatProvince(
  loserOwner: string,
  battleProvince: Province,
  allProvinces: Province[]
): Province | null {
  // Busca províncias vizinhas que pertencem ao país do perdedor
  const retreatProvinces = battleProvince.neighbors
    .map(neighborId => allProvinces.find(p => p.id === neighborId))
    .filter(p => p && p.owner === loserOwner);

  if (retreatProvinces.length === 0) {
    // Perdedor está cercado - não há rota de fuga
    return null;
  }

  // Retorna a primeira província própria encontrada (poderia ser otimizado para escolher a mais segura)
  return retreatProvinces[0]!;
}

/**
 * Aplica aniquilação total por cerco (100% de baixas)
 * Retorna um exército com 0 tropas
 */
export function applySiegeAnnihilation(army: Army): Army {
  console.log(`💀 Exército ${army.owner} aniquilado por cerco!`);
  return {
    ...army,
    regiments: [], // Remove todos os regimentos
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
 * Inicia batalhas contínuas e processa reforços em batalhas existentes
 */
export function checkAllProvinceCombats(
  armies: Army[],
  provinces: Province[],
  wars: Array<{ attacker: string; defender: string }>,
  currentDate: GameDate,
  activeBattles: ActiveBattle[],
  techBonusesByCountry?: Map<string, { infantry: number; cavalry: number; artillery: number }>
): {
  armies: Army[];
  newBattles: ActiveBattle[];
  updatedBattles: ActiveBattle[];
  reinforcementsAdded: Array<{
    battleId: string;
    armyId: string;
    armyOwner: string;
    side: 'attacker' | 'defender';
    troops: number;
    provinceName: string;
  }>;
} {
  const updatedArmies = [...armies];
  const newBattles: ActiveBattle[] = [];
  const updatedBattles: ActiveBattle[] = [...activeBattles];
  const reinforcementsAdded: Array<{
    battleId: string;
    armyId: string;
    armyOwner: string;
    side: 'attacker' | 'defender';
    troops: number;
    provinceName: string;
  }> = [];

  console.log('⚔️ checkAllProvinceCombats: verificando', provinces.length, 'províncias');

  // Percorre todas as províncias
  for (const province of provinces) {
    // Verifica se já existe uma batalha ativa nesta província
    const existingBattleIndex = updatedBattles.findIndex(b => b.provinceId === province.id);
    const existingBattle = existingBattleIndex !== -1 ? updatedBattles[existingBattleIndex] : null;

    // Encontra todos os exércitos nesta província que NÃO estão em combate
    const armiesInProvince = updatedArmies.filter(a => a.location === province.id && !a.inCombat);

    if (armiesInProvince.length === 0) continue; // Nenhum exército livre

    // Se já existe uma batalha, processa reforços
    if (existingBattle) {
      console.log(`⚔️ Batalha existente em ${province.name} - verificando reforços`);
      
      // Obtém os países envolvidos na batalha
      const attackerArmy = updatedArmies.find(a => a.id === existingBattle.attackerArmyId);
      const defenderArmy = updatedArmies.find(a => a.id === existingBattle.defenderArmyId);
      
      if (!attackerArmy || !defenderArmy) {
        console.warn(`⚠️ Batalha ${existingBattle.id} sem exércitos válidos - removendo`);
        updatedBattles.splice(existingBattleIndex, 1);
        continue;
      }
      
      const attackerCountry = attackerArmy.owner;
      const defenderCountry = defenderArmy.owner;
      
      console.log(`   Lado Atacante: ${attackerCountry}`);
      console.log(`   Lado Defensor: ${defenderCountry}`);
      console.log(`   Exércitos livres na província: ${armiesInProvince.length}`);
      
      if (armiesInProvince.length > 0) {
        armiesInProvince.forEach(army => {
          console.log(`     - ${army.id} (${army.owner})`);
        });
      }
      
      // Verifica cada exército livre para determinar o lado correto
      for (const army of armiesInProvince) {
        let side: 'attacker' | 'defender' | null = null;
        
        // PRIORIDADE 1: Mesma tag do país do atacante original
        if (army.owner === attackerCountry) {
          side = 'attacker';
          console.log(`⚔️ REFORÇOS: Exército ${army.id} (${army.owner}) entrou no lado ATACANTE da batalha em ${province.name}!`);
        }
        // PRIORIDADE 2: Mesma tag do país do defensor original
        else if (army.owner === defenderCountry) {
          side = 'defender';
          console.log(`⚔️ REFORÇOS: Exército ${army.id} (${army.owner}) entrou no lado DEFENSOR da batalha em ${province.name}!`);
        }
        // PRIORIDADE 3: Aliado do atacante (em guerra com o defensor)
        else {
          const isAtWarWithDefender = wars.some(
            w => (w.attacker === army.owner && w.defender === defenderCountry) ||
                 (w.defender === army.owner && w.attacker === defenderCountry)
          );
          
          if (isAtWarWithDefender) {
            side = 'attacker';
            console.log(`⚔️ REFORÇOS: Exército ${army.id} (${army.owner}) entrou no lado ATACANTE (aliado) da batalha em ${province.name}!`);
          }
        }
        
        // Se determinou o lado, adiciona como reforço
        if (side !== null) {
          const reinforcementTroops = calculateArmySize(army);
          const updatedBattle = addReinforcementsToBattle(existingBattle, army, side, province);
          updatedBattles[existingBattleIndex] = updatedBattle;
          
          // Adiciona à lista de reforços
          reinforcementsAdded.push({
            battleId: existingBattle.id,
            armyId: army.id,
            armyOwner: army.owner,
            side: side,
            troops: reinforcementTroops,
            provinceName: province.name,
          });
          
          // Marca exército como em combate
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = { ...updatedArmies[idx], inCombat: true };
          }
        } else {
          // Exército não se qualifica para nenhum lado
          console.log(`   ⚠️ Exército ${army.id} (${army.owner}) não entrou na batalha - sem relação com os lados`);
        }
      }
      
      // Log de resumo após processar todos os reforços
      const battleReinforcements = reinforcementsAdded.filter(r => r.battleId === existingBattle.id);
      if (battleReinforcements.length > 0) {
        console.log(`   ✅ Total de reforços adicionados à batalha: ${battleReinforcements.length}`);
        battleReinforcements.forEach(r => {
          console.log(`      - ${r.armyOwner}: ${r.troops} tropas (lado ${r.side})`);
        });
      }
      
      continue; // Batalha existente processada, pula para próxima província
    }

    // Se não há batalha existente, verifica se pode iniciar uma nova
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

    console.log(`⚔️ Iniciando batalha contínua em ${province.name}: ${attackerCountry} vs ${defenderCountry}`);
    console.log(`   Atacantes: ${attackerArmies.length} exércitos (${attackerArmies.reduce((sum, a) => sum + calculateArmySize(a), 0)} tropas)`);
    console.log(`   Defensores: ${defenderArmies.length} exércitos (${defenderArmies.reduce((sum, a) => sum + calculateArmySize(a), 0)} tropas)`);

    // Inicia batalha contínua com TODOS os exércitos
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBattle = startContinuousBattle(attackerArmies, defenderArmies, province, currentDate, battleId);
    newBattles.push(newBattle);

    // Marca TODOS os exércitos envolvidos como em combate
    for (const army of attackerArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx !== -1) {
        updatedArmies[idx] = { ...updatedArmies[idx], inCombat: true };
      }
    }
    for (const army of defenderArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx !== -1) {
        updatedArmies[idx] = { ...updatedArmies[idx], inCombat: true };
      }
    }
  }

  console.log('⚔️ checkAllProvinceCombats:', newBattles.length, 'novas batalhas iniciadas');
  if (reinforcementsAdded.length > 0) {
    console.log('⚔️ checkAllProvinceCombats:', reinforcementsAdded.length, 'reforços adicionados');
  }

  return { armies: updatedArmies, newBattles, updatedBattles, reinforcementsAdded };
}

/**
 * Inicia uma nova batalha contínua (não resolve instantaneamente)
 * Aceita múltiplos exércitos de cada lado para incluir todos desde o Dia 1
 */
export function startContinuousBattle(
  attackerArmies: Army[],
  defenderArmies: Army[],
  province: Province,
  currentDate: GameDate,
  battleId: string
): ActiveBattle {
  // Calcula tropas totais de cada lado
  const attackerTroops = attackerArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const defenderTroops = defenderArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const totalTroops = attackerTroops + defenderTroops;
  
  // Calcula duração da batalha (2000 tropas = 1 dia)
  const battleDays = Math.max(1, Math.ceil(totalTroops / COMBAT_BALANCE.TROOPS_PER_BATTLE_DAY));

  // Coleta todos os IDs de exércitos participantes
  const participantArmyIds = [
    ...attackerArmies.map(a => a.id),
    ...defenderArmies.map(a => a.id)
  ];

  console.log(`⚔️ Iniciando batalha contínua em ${province.name}: ${battleDays} dias`);
  console.log(`   Atacantes: ${attackerArmies.length} exércitos, ${attackerTroops} tropas`);
  console.log(`   Defensores: ${defenderArmies.length} exércitos, ${defenderTroops} tropas`);
  console.log(`   Total de participantes: ${participantArmyIds.length} exércitos`);

  return {
    id: battleId,
    provinceId: province.id,
    attackerArmyId: attackerArmies[0].id, // Mantém referência ao primeiro atacante
    defenderArmyId: defenderArmies[0].id, // Mantém referência ao primeiro defensor
    participantArmyIds: participantArmyIds,
    daysTotal: battleDays,
    daysRemaining: battleDays,
    attackerInitialTroops: attackerTroops,
    defenderInitialTroops: defenderTroops,
    attackerCurrentTroops: attackerTroops,
    defenderCurrentTroops: defenderTroops,
    attackerCasualties: 0,
    defenderCasualties: 0,
    startDate: currentDate,
  };
}

/**
 * Adiciona reforços a uma batalha existente
 * Recalcula a duração da batalha com base nas novas tropas
 */
export function addReinforcementsToBattle(
  battle: ActiveBattle,
  reinforcementArmy: Army,
  side: 'attacker' | 'defender',
  province: Province
): ActiveBattle {
  const reinforcementTroops = calculateArmySize(reinforcementArmy);
  
  console.log(`⚔️ REFORÇOS: Exército ${reinforcementArmy.id} (${reinforcementArmy.owner}) entrou na batalha em ${province.name}!`);
  console.log(`   Lado: ${side === 'attacker' ? 'Atacante' : 'Defensor'}`);
  console.log(`   Tropas adicionadas: ${reinforcementTroops}`);
  
  // Atualiza tropas do lado correspondente
  const updatedBattle = { ...battle };
  
  if (side === 'attacker') {
    updatedBattle.attackerCurrentTroops += reinforcementTroops;
    updatedBattle.attackerInitialTroops += reinforcementTroops;
  } else {
    updatedBattle.defenderCurrentTroops += reinforcementTroops;
    updatedBattle.defenderInitialTroops += reinforcementTroops;
  }
  
  // Adiciona o ID do reforço à lista de participantes
  if (!updatedBattle.participantArmyIds.includes(reinforcementArmy.id)) {
    updatedBattle.participantArmyIds = [...updatedBattle.participantArmyIds, reinforcementArmy.id];
    console.log(`   ✅ Exército ${reinforcementArmy.id} adicionado à lista de participantes`);
  }
  
  // Recalcula duração da batalha com base nas novas tropas totais
  const totalTroops = updatedBattle.attackerCurrentTroops + updatedBattle.defenderCurrentTroops;
  const additionalDays = Math.ceil(reinforcementTroops / COMBAT_BALANCE.TROOPS_PER_BATTLE_DAY);
  
  updatedBattle.daysTotal += additionalDays;
  updatedBattle.daysRemaining += additionalDays;
  
  console.log(`   Dias adicionais: ${additionalDays}`);
  console.log(`   Nova duração total: ${updatedBattle.daysTotal} dias`);
  console.log(`   Dias restantes: ${updatedBattle.daysRemaining}`);
  console.log(`   Total de participantes: ${updatedBattle.participantArmyIds.length} exércitos`);
  
  return updatedBattle;
}

/**
 * Processa um dia de batalha contínua
 * Aplica baixas diárias e reduz dias restantes
 */
export function processDailyBattle(
  battle: ActiveBattle,
  attacker: Army,
  defender: Army,
  province: Province
): {
  battle: ActiveBattle;
  attacker: Army;
  defender: Army;
  finished: boolean;
} {
  // Reduz dias restantes
  const daysRemaining = battle.daysRemaining - 1;
  
  // Calcula baixas diárias (distribuídas ao longo da batalha)
  const dailyAttackerLoss = Math.floor(battle.attackerInitialTroops / battle.daysTotal * 0.5);
  const dailyDefenderLoss = Math.floor(battle.defenderInitialTroops / battle.daysTotal * 0.5);
  
  // Aplica baixas
  const attackerCasualties = battle.attackerCasualties + dailyAttackerLoss;
  const defenderCasualties = battle.defenderCasualties + dailyDefenderLoss;
  
  const attackerCurrentTroops = Math.max(0, battle.attackerCurrentTroops - dailyAttackerLoss);
  const defenderCurrentTroops = Math.max(0, battle.defenderCurrentTroops - dailyDefenderLoss);
  
  // Atualiza exércitos com tropas reduzidas
  const updatedAttacker = applyTroopLoss(attacker, dailyAttackerLoss);
  const updatedDefender = applyTroopLoss(defender, dailyDefenderLoss);
  
  const updatedBattle: ActiveBattle = {
    ...battle,
    daysRemaining,
    attackerCasualties,
    defenderCasualties,
    attackerCurrentTroops,
    defenderCurrentTroops,
  };
  
  const finished = daysRemaining <= 0 || attackerCurrentTroops <= 0 || defenderCurrentTroops <= 0;
  
  console.log(`⚔️ Batalha ${battle.id}: Dia ${battle.daysTotal - daysRemaining}/${battle.daysTotal} - ${daysRemaining} dias restantes`);
  
  if (finished) {
    console.log(`✅ Batalha finalizada em ${province.name} após ${battle.daysTotal} dias`);
    console.log(`   Atacante: ${battle.attackerInitialTroops} → ${attackerCurrentTroops} (${attackerCasualties} baixas)`);
    console.log(`   Defensor: ${battle.defenderInitialTroops} → ${defenderCurrentTroops} (${defenderCasualties} baixas)`);
    console.log(`   Motivo: ${daysRemaining <= 0 ? 'Dias esgotados' : attackerCurrentTroops <= 0 ? 'Atacante destruído' : 'Defensor destruído'}`);
  }
  
  return {
    battle: updatedBattle,
    attacker: updatedAttacker,
    defender: updatedDefender,
    finished,
  };
}

/**
 * Aplica perda de tropas a um exército
 */
function applyTroopLoss(army: Army, loss: number): Army {
  if (loss <= 0 || army.regiments.length === 0) return army;
  
  let remainingLoss = loss;
  const updatedRegiments = army.regiments.map(reg => {
    if (remainingLoss <= 0) return reg;
    
    const regLoss = Math.min(reg.strength, remainingLoss);
    remainingLoss -= regLoss;
    
    return {
      ...reg,
      strength: Math.max(0, reg.strength - regLoss),
    };
  }).filter(reg => reg.strength > 0);
  
  return {
    ...army,
    regiments: updatedRegiments,
  };
}

/**
 * Finaliza uma batalha contínua e determina o vencedor
 */
export function finalizeBattle(
  battle: ActiveBattle,
  attacker: Army,
  defender: Army,
  province: Province,
  currentDate: GameDate,
  allArmies: Army[]
): { result: CombatResult; updatedArmies: Army[] } {
  // Determina vencedor baseado em tropas restantes
  const winner: 'attacker' | 'defender' = 
    battle.attackerCurrentTroops > battle.defenderCurrentTroops ? 'attacker' : 'defender';
  
  // Calcula ratio de poder final
  const powerRatio = winner === 'attacker' 
    ? battle.attackerCurrentTroops / Math.max(1, battle.defenderCurrentTroops)
    : battle.defenderCurrentTroops / Math.max(1, battle.attackerCurrentTroops);
  
  // Aplica baixas finais (vencedor 10-30%, perdedor 30-60%)
  let finalAttacker = attacker;
  let finalDefender = defender;
  
  if (winner === 'attacker') {
    const winnerLoss = calculateWinnerLosses(battle.attackerCurrentTroops, battle.daysTotal);
    const loserLoss = calculateLoserLosses(battle.defenderCurrentTroops, battle.daysTotal);
    
    finalAttacker = applyTroopLoss(attacker, winnerLoss);
    finalDefender = applyTroopLoss(defender, loserLoss);
  } else {
    const winnerLoss = calculateWinnerLosses(battle.defenderCurrentTroops, battle.daysTotal);
    const loserLoss = calculateLoserLosses(battle.attackerCurrentTroops, battle.daysTotal);
    
    finalDefender = applyTroopLoss(defender, winnerLoss);
    finalAttacker = applyTroopLoss(attacker, loserLoss);
  }
  
  // 🔓 LIBERA TODOS OS EXÉRCITOS PARTICIPANTES (incluindo reforços)
  const participantIds = battle.participantArmyIds;
  console.log(`🔓 LIBERADOS: Exércitos ${participantIds.join(', ')} agora estão fora de combate.`);
  
  // Marca todos os participantes como inCombat = false
  const updatedAllArmies = allArmies.map(army => {
    if (participantIds.includes(army.id)) {
      return { ...army, inCombat: false };
    }
    return army;
  });
  
  const result: CombatResult = {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal: { ...attacker, regiments: attacker.regiments.map(r => ({ ...r })) },
    defenderOriginal: { ...defender, regiments: defender.regiments.map(r => ({ ...r })) },
    attackerCasualties: battle.attackerCasualties + (calculateArmySize(attacker) - calculateArmySize(finalAttacker)),
    defenderCasualties: battle.defenderCasualties + (calculateArmySize(defender) - calculateArmySize(finalDefender)),
    winner,
    provinceId: province.id,
    provinceName: province.name,
    duration: battle.daysTotal,
    territoryChanged: false,
    territorialDefenseBonus: province.owner === defender.owner,
    powerRatio: Math.round(powerRatio * 100) / 100,
    date: currentDate,
  };
  
  console.log(`🏆 Vencedor: ${winner === 'attacker' ? 'Atacante' : 'Defensor'} em ${province.name}`);
  
  return { result, updatedArmies: updatedAllArmies };
}

/**
 * Recuo manual de um exército durante batalha
 * Remove o exército da batalha e move para província vizinha amigável
 */
export function retreatArmyManually(
  armyId: string,
  battleId: string,
  armies: Army[],
  activeBattles: ActiveBattle[],
  provinces: Province[]
): {
  armies: Army[];
  activeBattles: ActiveBattle[];
  retreatSuccess: boolean;
  battleEnded: boolean;
  winner?: 'attacker' | 'defender';
} {
  // Encontra o exército
  const army = armies.find(a => a.id === armyId);
  if (!army) {
    console.warn(`❌ Exército ${armyId} não encontrado`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Encontra a batalha
  const battle = activeBattles.find(b => b.id === battleId);
  if (!battle) {
    console.warn(`❌ Batalha ${battleId} não encontrada`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Verifica se o exército está na batalha
  if (!battle.participantArmyIds.includes(armyId)) {
    console.warn(`❌ Exército ${armyId} não está participando da batalha ${battleId}`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Encontra a província da batalha
  const battleProvince = provinces.find(p => p.id === battle.provinceId);
  if (!battleProvince) {
    console.warn(`❌ Província da batalha não encontrada`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Determina o lado do exército (atacante ou defensor)
  const isAttackerSide = battle.attackerArmyId === armyId || 
    armies.some(a => battle.participantArmyIds.includes(a.id) && a.owner === army.owner && a.id !== armyId && a.id === battle.attackerArmyId);
  
  // Encontra província de recuo
  const retreatProvince = findRetreatProvince(army.owner, battleProvince, provinces);
  
  if (!retreatProvince) {
    console.warn(`❌ Nenhuma província de recuo disponível para ${army.owner}`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  console.log(`🏃 Exército ${armyId} (${army.owner}) recuando de ${battleProvince.name} para ${retreatProvince.name}`);

  // Remove exército da lista de participantes
  const updatedBattle = {
    ...battle,
    participantArmyIds: battle.participantArmyIds.filter(id => id !== armyId)
  };

  // Recalcula tropas do lado
  const armyTroops = calculateArmySize(army);
  if (isAttackerSide) {
    updatedBattle.attackerCurrentTroops = Math.max(0, updatedBattle.attackerCurrentTroops - armyTroops);
  } else {
    updatedBattle.defenderCurrentTroops = Math.max(0, updatedBattle.defenderCurrentTroops - armyTroops);
  }

  // Move exército para província de recuo e libera do combate
  const updatedArmies = armies.map(a => {
    if (a.id === armyId) {
      return { ...a, location: retreatProvince.id, inCombat: false };
    }
    return a;
  });

  // Verifica se todos os exércitos de um lado recuaram
  const remainingAttackerArmies = updatedBattle.participantArmyIds.filter(id => {
    const participantArmy = updatedArmies.find(a => a.id === id);
    return participantArmy && participantArmy.owner === (isAttackerSide ? army.owner : undefined);
  });

  // Se não há mais exércitos de um lado, finaliza a batalha
  if (updatedBattle.participantArmyIds.length === 0) {
    console.log(`🏁 Batalha ${battleId} finalizada - todos os exércitos recuaram`);
    
    // Remove batalha da lista
    const updatedBattles = activeBattles.filter(b => b.id !== battleId);
    
    // Determina vencedor (o lado que ainda tem exércitos, ou atacante se ambos recuaram)
    const winner = updatedBattle.attackerCurrentTroops > 0 ? 'attacker' : 'defender';
    
    return {
      armies: updatedArmies,
      activeBattles: updatedBattles,
      retreatSuccess: true,
      battleEnded: true,
      winner
    };
  }

  // Atualiza lista de batalhas
  const updatedBattles = activeBattles.map(b => b.id === battleId ? updatedBattle : b);

  return {
    armies: updatedArmies,
    activeBattles: updatedBattles,
    retreatSuccess: true,
    battleEnded: false
  };
}
