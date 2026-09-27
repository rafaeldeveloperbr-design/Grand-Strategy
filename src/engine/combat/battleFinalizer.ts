import { Army, Province, ActiveBattle, GameDate, CombatResult } from '../../types';
import {
  applyTroopLoss,
  calculateArmyBasePower,
  calculateArmySize,
  calculateLoserLosses,
  calculateWinnerLosses,
} from './combatCalculations';

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
  
  // Salva snapshot dos exércitos ANTES das baixas finais (após baixas diárias)
  const attackerBeforeFinalLoss = {
    ...attacker,
    regiments: attacker.regiments.map(r => ({ ...r }))
  };
  const defenderBeforeFinalLoss = {
    ...defender,
    regiments: defender.regiments.map(r => ({ ...r }))
  };
  
  console.log(`📊 Exércitos antes das baixas finais:`);
  console.log(`   Atacante: ${calculateArmySize(attackerBeforeFinalLoss)} tropas`);
  console.log(`   Defensor: ${calculateArmySize(defenderBeforeFinalLoss)} tropas`);
  
  // Aplica baixas finais (vencedor 10-30%, perdedor 30-60%)
  let finalAttacker = attacker;
  let finalDefender = defender;
  
  if (winner === 'attacker') {
    const winnerLoss = calculateWinnerLosses(battle.attackerCurrentTroops, battle.defenderCurrentTroops, powerRatio);
    const loserLoss = calculateLoserLosses(battle.defenderCurrentTroops, powerRatio);
    
    console.log(`💥 Aplicando baixas finais (atacante venceu):`);
    console.log(`   Vencedor (atacante) perde: ${winnerLoss} tropas`);
    console.log(`   Perdedor (defensor) perde: ${loserLoss} tropas`);
    
    finalAttacker = applyTroopLoss(attacker, winnerLoss);
    finalDefender = applyTroopLoss(defender, loserLoss);
  } else {
    const winnerLoss = calculateWinnerLosses(battle.defenderCurrentTroops, battle.attackerCurrentTroops, powerRatio);
    const loserLoss = calculateLoserLosses(battle.attackerCurrentTroops, powerRatio);
    
    console.log(`💥 Aplicando baixas finais (defensor venceu):`);
    console.log(`   Vencedor (defensor) perde: ${winnerLoss} tropas`);
    console.log(`   Perdedor (atacante) perde: ${loserLoss} tropas`);
    
    finalDefender = applyTroopLoss(defender, loserLoss);
    finalAttacker = applyTroopLoss(attacker, loserLoss);
  }
  
  console.log(`📊 Exércitos após baixas finais:`);
  console.log(`   Atacante: ${calculateArmySize(finalAttacker)} tropas`);
  console.log(`   Defensor: ${calculateArmySize(finalDefender)} tropas`);
  
  // 🔓 LIBERA TODOS OS EXÉRCITOS PARTICIPANTES E AJUSTA O ESTADO DE MOVIMENTO
  const participantIds = battle.participantArmyIds;
  console.log(`🔓 LIBERADOS: Exércitos ${participantIds.join(', ')} agora estão fora de combate.`);
  

// Mapeia allArmies atualizando as baixas finais e destravando as flags de combate e movimento
const updatedAllArmies = allArmies.map(army => {
  if (!participantIds.includes(army.id)) {
    return army;
  }

  // Identifica se é o atacante ou defensor principal que sofreu baixas finais
  let updatedArmy = army;
  if (army.id === attacker.id) {
    updatedArmy = finalAttacker;
  } else if (army.id === defender.id) {
    updatedArmy = finalDefender;
  }

  // Verifica se o exército chegou ao fim da rota planejada
  const path = updatedArmy.path || [];
  const hasReachedDestination = path.length === 0;

  return {
    ...updatedArmy,
    inCombat: false,
    // Se concluiu a rota, reseta destino e rota; caso contrário, preserva
    destination: hasReachedDestination ? null : updatedArmy.destination,
    targetDestination: hasReachedDestination ? null : updatedArmy.targetDestination,
    path: hasReachedDestination ? [] : path,
    // Garante que se o exército parou de andar, sua posição é fixada na província da batalha
    location: hasReachedDestination ? province.id : updatedArmy.location,
  };
});
  
  // Usa snapshots iniciais do ActiveBattle (se disponíveis) ou cria novos
  const attackerOriginal = battle.attackerInitialSnapshot 
    ? { ...battle.attackerInitialSnapshot, regiments: battle.attackerInitialSnapshot.regiments.map(r => ({ ...r })) }
    : { ...attacker, regiments: attacker.regiments.map(r => ({ ...r })) };
  
  const defenderOriginal = battle.defenderInitialSnapshot
    ? { ...battle.defenderInitialSnapshot, regiments: battle.defenderInitialSnapshot.regiments.map(r => ({ ...r })) }
    : { ...defender, regiments: defender.regiments.map(r => ({ ...r })) };

  // Log de verificação dos snapshots
  const initialAttackerSize = battle.attackerInitialSnapshot 
    ? calculateArmySize(battle.attackerInitialSnapshot)
    : calculateArmySize(attacker);
  const initialDefenderSize = battle.defenderInitialSnapshot
    ? calculateArmySize(battle.defenderInitialSnapshot)
    : calculateArmySize(defender);

  // Calcula baixas totais usando os snapshots iniciais
  const attackerTotalCasualties = initialAttackerSize - calculateArmySize(finalAttacker);
  const defenderTotalCasualties = initialDefenderSize - calculateArmySize(finalDefender);

  // Cria o resultado da batalha
  const result: CombatResult = {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal,
    defenderOriginal,
    attackerCasualties: attackerTotalCasualties,
    defenderCasualties: defenderTotalCasualties,
    winner,
    provinceId: province.id,
    provinceName: province.name,
    duration: battle.daysTotal,
    territoryChanged: false,
    territorialDefenseBonus: province.owner === defender.owner,
    powerRatio: Math.round(powerRatio * 100) / 100,
    date: currentDate,
  };
  
  return { result, updatedArmies: updatedAllArmies };
}