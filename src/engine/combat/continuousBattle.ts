import { Army, Province, ActiveBattle, GameDate, CombatResult } from '../../types';
import { War } from '../../types/diplomacy';
import { COMBAT_BALANCE, applyTroopLoss, calculateArmySize } from './combatCalculations';

/**
 * Verifica automaticamente combates em todas as províncias
 */
export function checkAllProvinceCombats(
  armies: Army[],
  provinces: Province[],
  wars: Array<{ attacker: string; defender: string }>,
  currentDate: GameDate,
  activeBattles: ActiveBattle[],
  techBonusesByCountry?: Map<string, { infantry: number; cavalry: number; artillery: number }>
) {
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

  for (const province of provinces) {
    const existingBattleIndex = updatedBattles.findIndex(b => b.provinceId === province.id);
    const existingBattle = existingBattleIndex!== -1? updatedBattles[existingBattleIndex] : null;
    const armiesInProvince = updatedArmies.filter(a => a.location === province.id &&!a.inCombat);
    if (armiesInProvince.length === 0) continue;

    if (existingBattle) {
      const attackerArmy = updatedArmies.find(a => a.id === existingBattle.attackerArmyId);
      const defenderArmy = updatedArmies.find(a => a.id === existingBattle.defenderArmyId);
      if (!attackerArmy ||!defenderArmy) {
        updatedBattles.splice(existingBattleIndex, 1);
        continue;
      }
      const attackerCountry = attackerArmy.owner;
      const defenderCountry = defenderArmy.owner;

      for (const army of armiesInProvince) {
        let side: 'attacker' | 'defender' | null = null;
        if (army.owner === attackerCountry) side = 'attacker';
        else if (army.owner === defenderCountry) side = 'defender';
        else {
          const isAtWarWithDefender = wars.some(
            w => (w.attacker === army.owner && w.defender === defenderCountry) ||
                 (w.defender === army.owner && w.attacker === defenderCountry)
          );
          if (isAtWarWithDefender) side = 'attacker';
        }
        if (side!== null) {
          const reinforcementTroops = calculateArmySize(army);
          const updatedBattle = addReinforcementsToBattle(existingBattle, army, side, province);
          updatedBattles[existingBattleIndex] = updatedBattle;
          reinforcementsAdded.push({
            battleId: existingBattle.id,
            armyId: army.id,
            armyOwner: army.owner,
            side: side,
            troops: reinforcementTroops,
            provinceName: province.name,
          });
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx!== -1) updatedArmies[idx] = {...updatedArmies[idx], inCombat: true };
        }
      }
      continue;
    }

    if (armiesInProvince.length < 2) continue;
    const armiesByCountry = new Map<string, Army[]>();
    for (const army of armiesInProvince) {
      if (!armiesByCountry.has(army.owner)) armiesByCountry.set(army.owner, []);
      armiesByCountry.get(army.owner)!.push(army);
    }
    if (armiesByCountry.size < 2) continue;

    const provinceOwner = province.owner;
    let attackerCountry: string | null = null;
    let defenderCountry: string | null = null;

    for (const country of armiesByCountry.keys()) {
      if (country === provinceOwner) defenderCountry = country;
      else {
        const isAtWar = wars.some(
          w => (w.attacker === country && w.defender === provinceOwner) ||
               (w.defender === country && w.attacker === provinceOwner)
        );
        if (isAtWar) attackerCountry = country;
      }
    }
    if (!attackerCountry ||!defenderCountry) continue;
    const attackerArmies = armiesByCountry.get(attackerCountry) || [];
    const defenderArmies = armiesByCountry.get(defenderCountry) || [];
    if (attackerArmies.length === 0 || defenderArmies.length === 0) continue;

    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBattle = startContinuousBattle(attackerArmies, defenderArmies, province, currentDate, battleId);
    newBattles.push(newBattle);

    for (const army of attackerArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx!== -1) updatedArmies[idx] = {...updatedArmies[idx], inCombat: true };
    }
    for (const army of defenderArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx!== -1) updatedArmies[idx] = {...updatedArmies[idx], inCombat: true };
    }
  }
  return { armies: updatedArmies, newBattles, updatedBattles, reinforcementsAdded };
}

/**
 * Duração: se ≤1k = 1 dia direto
 */
export function startContinuousBattle(
  attackerArmies: Army[],
  defenderArmies: Army[],
  province: Province,
  currentDate: GameDate,
  battleId: string
): ActiveBattle {
  const attackerTroops = attackerArmies.reduce((s, a) => s + calculateArmySize(a), 0);
  const defenderTroops = defenderArmies.reduce((s, a) => s + calculateArmySize(a), 0);
  const smallerArmyTroops = Math.min(attackerTroops, defenderTroops);

  let battleDays: number;
  if (smallerArmyTroops <= 1000) {
    battleDays = 1; // PEDIDO: ≤1k acaba em 1 dia
  } else if (smallerArmyTroops <= 2500) {
    battleDays = 3;
  } else {
    battleDays = Math.max(2, Math.floor(smallerArmyTroops / 1500));
  }

  const participantArmyIds = [
  ...attackerArmies.map(a => a.id),
  ...defenderArmies.map(a => a.id)
  ];

  console.log(`⚔️ Batalha em ${province.name}: ${battleDays} dias | Att ${attackerTroops} vs Def ${defenderTroops}`);

  return {
    id: battleId,
    provinceId: province.id,
    attackerArmyId: attackerArmies[0].id,
    defenderArmyId: defenderArmies[0].id,
    participantArmyIds,
    daysTotal: battleDays,
    daysRemaining: battleDays,
    attackerInitialTroops: attackerTroops,
    defenderInitialTroops: defenderTroops,
    attackerCurrentTroops: attackerTroops,
    defenderCurrentTroops: defenderTroops,
    attackerCasualties: 0,
    defenderCasualties: 0,
    startDate: currentDate,
    attackerInitialSnapshot: {...attackerArmies[0], regiments: attackerArmies[0].regiments.map(r => ({...r})) },
    defenderInitialSnapshot: {...defenderArmies[0], regiments: defenderArmies[0].regiments.map(r => ({...r})) },
  } as any;
}

export function addReinforcementsToBattle(
  battle: ActiveBattle,
  reinforcementArmy: Army,
  side: 'attacker' | 'defender',
  province: Province
): ActiveBattle {
  const reinforcementTroops = calculateArmySize(reinforcementArmy);
  const updatedBattle = {...battle, participantArmyIds: [...battle.participantArmyIds] } as any;
  if (side === 'attacker') updatedBattle.attackerCurrentTroops += reinforcementTroops;
  else updatedBattle.defenderCurrentTroops += reinforcementTroops;
  if (!updatedBattle.participantArmyIds.includes(reinforcementArmy.id)) {
    updatedBattle.participantArmyIds.push(reinforcementArmy.id);
  }
  updatedBattle.reinforcementEntryDay = updatedBattle.reinforcementEntryDay || {};
  updatedBattle.reinforcementEntryDay[reinforcementArmy.id] = battle.daysTotal - battle.daysRemaining;
  updatedBattle.reinforcementInitialSize = updatedBattle.reinforcementInitialSize || {};
  updatedBattle.reinforcementInitialSize[reinforcementArmy.id] = reinforcementTroops;
  return updatedBattle;
}

function getDefenseBonus(province: Province): number {
  const p = province as any;
  let bonus = 0.05;
  bonus += (p.fortLevel?? p.fort_level?? 0) * 0.05;
  const terrain = p.terrain?? p.terrainType?? '';
  if (terrain === 'mountain') bonus += 0.15;
  if (terrain === 'hill') bonus += 0.10;
  if (terrain === 'forest') bonus += 0.05;
  bonus += (p.buildings?.barracks?? 0) * 0.03;
  bonus += (p.buildings?.walls?? 0) * 0.04;
  return Math.min(0.5, bonus);
}

// NOVO: Só recua pra província DELE mesmo (RNO -> RNO, KHA -> KHA)
function findRetreatProvince(
  currentProvince: Province,
  loserOwner: string,
  allProvinces: Province[]
): Province | null {
  const neighbors = (currentProvince as any).neighbors || (currentProvince as any).adjacentProvinces || (currentProvince as any).adjacent || [];

  console.log(`🔍 Buscando recuo pra ${loserOwner} a partir de ${currentProvince.name}. Vizinhos:`, neighbors);

  for (const prov of allProvinces) {
    const isNeighbor = neighbors.includes(prov.id);
    if (!isNeighbor) continue;

    // SÓ SE FOR DO MESMO DONO
    if (prov.owner === loserOwner) {
      console.log(`✅ Rota de recuo encontrada: ${prov.name} (${prov.owner})`);
      return prov;
    }
  }

  console.log(`❌ Sem província de ${loserOwner} vizinha pra recuar - vai lutar até morrer`);
  return null;
}

export function processDailyBattle(
  battle: ActiveBattle,
  attacker: Army,
  defender: Army,
  province: Province,
  allProvinces: Province[] = [],
  wars: Array<{ attacker: string; defender: string }> = []
) {
  const daysRemaining = battle.daysRemaining - 1;
  const bonus = getDefenseBonus(province);
  const daysTotal = Math.max(1, battle.daysTotal);
  const defInitial = battle.defenderInitialTroops;

  const attackerLoss = Math.min(
    battle.attackerCurrentTroops,
    Math.floor((defInitial * (1 + bonus)) / daysTotal)
  );
  const defenderLoss = Math.min(
    battle.defenderCurrentTroops,
    Math.floor((defInitial / daysTotal) * 0.95)
  );

  let updatedAttacker = applyTroopLoss(attacker, attackerLoss);
  let updatedDefender = applyTroopLoss(defender, defenderLoss);

  let newAttackerTroops = Math.max(0, battle.attackerCurrentTroops - attackerLoss);
  let newDefenderTroops = Math.max(0, battle.defenderCurrentTroops - defenderLoss);

  let finished = daysRemaining <= 0 || newAttackerTroops <= 50 || newDefenderTroops <= 50;
  let retreatInfo: any = null;

  if (finished) {
    const isAttackerLoser = newAttackerTroops <= newDefenderTroops;
    const loserTroops = isAttackerLoser ? newAttackerTroops : newDefenderTroops;
    const loserOwner = isAttackerLoser ? updatedAttacker.owner : updatedDefender.owner;

    if (loserTroops > 0 && loserTroops <= 1500) {
      const retreatProv = findRetreatProvince(province, loserOwner, allProvinces);
      if (retreatProv) {
        console.log(`🏃 RECUO: ${loserOwner} com ${loserTroops} recuando de ${province.name} para ${retreatProv.name}`);
        
        if (isAttackerLoser) {
          updatedAttacker = { ...updatedAttacker, location: retreatProv.id, inCombat: false, destination: null, path: [], movementProgress: 0 } as any;
        } else {
          updatedDefender = { ...updatedDefender, location: retreatProv.id, inCombat: false, destination: null, path: [], movementProgress: 0 } as any;
        }

        retreatInfo = { retreated: true, to: retreatProv.id, toName: retreatProv.name, troops: loserTroops, owner: loserOwner };
        
        if (loserTroops <= 1000) {
          console.log(`⏱️ ${loserTroops} ≤1k - próxima batalha 1 dia`);
        }
      } else {
        console.log(`💀 Sem rota de ${loserOwner} - aniquilado em ${province.name}`);
        if (isAttackerLoser) {
          updatedAttacker = applyTroopLoss(updatedAttacker, calculateArmySize(updatedAttacker));
          newAttackerTroops = 0;
        } else {
          updatedDefender = applyTroopLoss(updatedDefender, calculateArmySize(updatedDefender));
          newDefenderTroops = 0;
        }
      }
    }
  }

  // FIX pro modal
  if (retreatInfo?.retreated) {
    console.log(`📤 Enviando retreatInfo para modal: ${retreatInfo.troops} para ${retreatInfo.toName}`);
  }

  return {
    battle: {
      ...battle,
      daysRemaining,
      attackerCasualties: battle.attackerCasualties + attackerLoss,
      defenderCasualties: battle.defenderCasualties + defenderLoss,
      attackerCurrentTroops: newAttackerTroops,
      defenderCurrentTroops: newDefenderTroops,
      retreatInfo,
    } as any,
    attacker: updatedAttacker,
    defender: updatedDefender,
    attackerCurrentTroops: newAttackerTroops,
    defenderCurrentTroops: newDefenderTroops,
    finished,
    retreatInfo,
  };
}



function triggerRetreat(army: Army, currentProvince: Province) {
  army.inCombat = false;
  army.destination = army.owner;
  army.targetDestination = army.owner;
  army.path = [army.owner];
}