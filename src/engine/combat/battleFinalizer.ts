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
  const winner: 'attacker' | 'defender' =
    battle.attackerCurrentTroops > battle.defenderCurrentTroops? 'attacker' : 'defender';

  const powerRatio = winner === 'attacker'
   ? battle.attackerCurrentTroops / Math.max(1, battle.defenderCurrentTroops)
    : battle.defenderCurrentTroops / Math.max(1, battle.attackerCurrentTroops);

  // CORREÇÃO: Não aplica baixa final dupla. Usa só o que já perdeu no diário
  // Se quiser baixa final, que seja 5% extra, não 30%
  let finalAttacker = attacker;
  let finalDefender = defender;

  if (battle.shouldRetreatAttacker || battle.shouldRetreatDefender) {
    console.log(`🏃 Recuo em 1k detectado`);
  } else {
    // Só aplica 5% extra de baixa final pra não duplicar
    const extraLossWinner = Math.floor(
      (winner === 'attacker'? battle.attackerCurrentTroops : battle.defenderCurrentTroops) * 0.05
    );
    const extraLossLoser = Math.floor(
      (winner === 'attacker'? battle.defenderCurrentTroops : battle.attackerCurrentTroops) * 0.10
    );

    if (winner === 'attacker') {
      finalAttacker = applyTroopLoss(attacker, extraLossWinner);
      finalDefender = applyTroopLoss(defender, extraLossLoser);
    } else {
      // CORREÇÃO DO BUG 1 AQUI
      finalDefender = applyTroopLoss(defender, extraLossWinner);
      finalAttacker = applyTroopLoss(attacker, extraLossLoser);
    }
  }

  // CORREÇÃO BUG 3 - Libera TODO MUNDO e limpa battleId
  const participantIds = battle.participantArmyIds;
  const updatedAllArmies = allArmies.map(army => {
    if (!participantIds.includes(army.id)) return army;

    let updatedArmy = army;
    if (army.id === attacker.id) updatedArmy = finalAttacker;
    else if (army.id === defender.id) updatedArmy = finalDefender;
    // reforços mantém o tamanho que já tem (já perderam no diário)

    // LÓGICA DE RECUO <1k que você pediu
    const isRetreating =
      (army.id === attacker.id && battle.shouldRetreatAttacker) ||
      (army.id === defender.id && battle.shouldRetreatDefender);

    if (isRetreating) {
      // Tenta achar província amiga vizinha
      // Se não tiver, luta até morrer (não entra aqui, já acabou)
      const retreatProvinceId = findFriendlyNeighbor(province, army.owner, allArmies);
      return {
       ...updatedArmy,
        inCombat: false,
        battleId: null as any,
        destination: retreatProvinceId || null,
        targetDestination: retreatProvinceId || null,
        path: retreatProvinceId? [retreatProvinceId] : [],
        location: province.id, // fica na província da batalha até mover
      };
    }

    return {
     ...updatedArmy,
      inCombat: false,
      battleId: null as any,
      // NÃO reseta destination/path se ele tava indo pra outro lugar
      // Só limpa se ele chegou
      destination: updatedArmy.destination,
      targetDestination: updatedArmy.targetDestination,
      path: updatedArmy.path || [],
      location: province.id,
    };
  });

  //... resto do seu código de CombatResult igual
  const attackerOriginal = battle.attackerInitialSnapshot
   ? {...battle.attackerInitialSnapshot, regiments: battle.attackerInitialSnapshot.regiments.map(r => ({...r })) }
    : {...attacker, regiments: attacker.regiments.map(r => ({...r })) };

  const defenderOriginal = battle.defenderInitialSnapshot
   ? {...battle.defenderInitialSnapshot, regiments: battle.defenderInitialSnapshot.regiments.map(r => ({...r })) }
    : {...defender, regiments: defender.regiments.map(r => ({...r })) };

  const initialAttackerSize = calculateArmySize(battle.attackerInitialSnapshot || attacker);
  const initialDefenderSize = calculateArmySize(battle.defenderInitialSnapshot || defender);

  const result: CombatResult = {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal,
    defenderOriginal,
    attackerCasualties: initialAttackerSize - calculateArmySize(finalAttacker),
    defenderCasualties: initialDefenderSize - calculateArmySize(finalDefender),
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

function findFriendlyNeighbor(province: Province, owner: string, allArmies: Army[]): string | null {
  // Você já deve ter adjacências em provinces.ts
  // Retorna primeira província vizinha do mesmo dono
  // Se não tiver, retorna null = luta até morrer
  return null; // implementa com seu provinces adjacency
}