import { Army, Province, ActiveBattle, GameDate, CombatResult } from '../../types';
import {
  calculateArmyBasePower,
  calculateArmySize,
  calculateBattleDuration,
  calculateDefenderTotalPower,
  calculateLoserLosses,
  calculateWinnerLosses,
  distributeLosses,
} from './combatCalculations';
import { applySiegeAnnihilation } from './combatRetreats';


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
     attackerLoss = calculateWinnerLosses(attackerOriginalSize, defenderOriginalSize, powerRatio);
    defenderLoss = calculateLoserLosses(defenderOriginalSize, powerRatio);

    finalAttacker = distributeLosses(attacker, attackerLoss);
    finalDefender = distributeLosses(defender, defenderLoss);
  } else {
    // Defensor venceu
    defenderLoss = calculateWinnerLosses(defenderOriginalSize, attackerOriginalSize, powerRatio);
    attackerLoss = calculateLoserLosses(attackerOriginalSize, powerRatio);

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