import { Army, Province, ActiveBattle, GameDate, CombatResult, Country } from '../../types';
import { applyTroopLoss, calculateArmySize } from './combatCalculations';

export function finalizeBattle(
  battle: ActiveBattle,
  attacker: Army,
  defender: Army,
  province: Province,
  currentDate: GameDate,
  allArmies: Army[],
  allProvinces: Province[] = [],
  allCountries: Country[] = []
): { result: CombatResult; updatedArmies: Army[] } {

  const defenderParticipants = allArmies.filter(a =>
    battle.participantArmyIds.includes(a.id) && a.owner === defender.owner
  );
  const attackerParts = allArmies.filter(a =>
    battle.participantArmyIds.includes(a.id) && a.owner !== defender.owner
  );

  const totalAttacker = attackerParts.reduce((s, a) => s + calculateArmySize(a), 0) || battle.attackerCurrentTroops;
  const totalDefender = defenderParticipants.reduce((s, a) => s + calculateArmySize(a), 0) || battle.defenderCurrentTroops;

  const winner: 'attacker' | 'defender' = totalAttacker > totalDefender ? 'attacker' : 'defender';
  const loserOwner = winner === 'attacker' ? defender.owner : attacker.owner;

  // STACKWIPE CHECK - ratio >= 10:1 e perdedor pequeno
  const powerRatio = totalAttacker / Math.max(1, totalDefender);
  const inverseRatio = totalDefender / Math.max(1, totalAttacker);
  const ratioForWipe = Math.max(powerRatio, inverseRatio);
  const totalLoserSize = winner === 'attacker' ? totalDefender : totalAttacker;
  const isStackwipe = ratioForWipe >= 10 && totalLoserSize <= 2000;

  let finalAttacker = attacker;
  let finalDefender = defender;

  if (!battle.shouldRetreatAttacker && !battle.shouldRetreatDefender && !isStackwipe) {
    const extraWinner = Math.floor((winner === 'attacker' ? battle.attackerCurrentTroops : battle.defenderCurrentTroops) * 0.05);
    const extraLoser = Math.floor((winner === 'attacker' ? battle.defenderCurrentTroops : battle.attackerCurrentTroops) * 0.10);
    if (winner === 'attacker') {
      finalAttacker = applyTroopLoss(attacker, extraWinner);
      finalDefender = applyTroopLoss(defender, extraLoser);
    } else {
      finalDefender = applyTroopLoss(defender, extraWinner);
      finalAttacker = applyTroopLoss(attacker, extraLoser);
    }
  }

  const findCapitalId = (owner: string): string | null => {
    const country = allCountries.find(c => c.tag === owner);
    if (!country) return null;
    return (country as any).capital || country.provinces[0] || null;
  };

  let remainingLoserTroopsToKeep = isStackwipe ? 0 : 1000; // SE STACKWIPE = 0

  const updatedAllArmies = allArmies.map(army => {
    if (!battle.participantArmyIds.includes(army.id)) return army;
    let updatedArmy = army;
    if (army.id === attacker.id) updatedArmy = finalAttacker;
    else if (army.id === defender.id) updatedArmy = finalDefender;

    const isLoser = army.owner === loserOwner;
    if (!isLoser) {
      return { ...updatedArmy, inCombat: false, battleId: null as any, destination: null, targetDestination: null, path: [], location: province.id };
    }

    // PERDEDOR
    if (remainingLoserTroopsToKeep <= 0) {
      // ANIQUILADO
      return {
        ...updatedArmy,
        regiments: [], // zera de verdade
        // força size 0
        strength: 0, inCombat: false,
        battleId: null as any,
        location: findCapitalId(army.owner) || province.id,
        destination: null,
        targetDestination: null,
        path: [],
        morale: 0,
        lastRetreatDate: currentDate
      } as any;
    }

    const currentSize = calculateArmySize(updatedArmy);
    const keep = Math.min(currentSize, remainingLoserTroopsToKeep);
    const lose = currentSize - keep;
    remainingLoserTroopsToKeep -= keep;
    const trimmed = lose > 0 ? applyTroopLoss(updatedArmy, lose) : updatedArmy;
    return {
      ...trimmed,
      inCombat: false,
      battleId: null as any,
      location: findCapitalId(army.owner) || province.id,
      destination: null,
      targetDestination: null,
      path: [],
      morale: 0.1, // moral quebrada
      lastRetreatDate: currentDate
    } as any;
  });

  const attackerOriginal = battle.attackerInitialSnapshot ? { ...battle.attackerInitialSnapshot, regiments: battle.attackerInitialSnapshot.regiments.map(r => ({ ...r })) } : { ...attacker, regiments: attacker.regiments.map(r => ({ ...r })) };
  const defenderOriginal = battle.defenderInitialSnapshot ? { ...battle.defenderInitialSnapshot, regiments: battle.defenderInitialSnapshot.regiments.map(r => ({ ...r })) } : { ...defender, regiments: defender.regiments.map(r => ({ ...r })) };

  // CALCULA CASUALTIES REAL POS-RECUO
  const finalAttackerSize = updatedAllArmies.filter(a => battle.participantArmyIds.includes(a.id) && a.owner === attacker.owner).reduce((s, a) => s + calculateArmySize(a), 0);
  const finalDefenderSize = updatedAllArmies.filter(a => battle.participantArmyIds.includes(a.id) && a.owner === defender.owner).reduce((s, a) => s + calculateArmySize(a), 0);

  const result: CombatResult = {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal,
    defenderOriginal,
    attackerCasualties: (battle.attackerInitialTroops + ((battle as any).attackerReinfInitial || 0)) - finalAttackerSize,
    defenderCasualties: (battle.defenderInitialTroops + ((battle as any).defenderReinfInitial || 0)) - finalDefenderSize,
    winner,
    provinceId: province.id,
    provinceName: province.name,
    duration: battle.daysTotal,
    territoryChanged: false,
    territorialDefenseBonus: province.owner === defender.owner,
    powerRatio: Math.round(ratioForWipe * 100) / 100,
    date: currentDate,
    isStackwipe
  } as any;

  return { result, updatedArmies: updatedAllArmies };
}