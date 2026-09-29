/**
 * battleContinuousTick.ts - PASSO 4.4
 */
import { processDailyBattle, finalizeBattle } from '../../engine/combat';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { applyConquestUnrest } from '../../engine/unrest';
import { applyStabilityPrestigeChanges } from '../../engine/stability';
import type { Army, Province, Country, War, ActiveBattle, Recruitment, BuildingConstruction } from '../../types';
import type { GameDate } from '../../types/date';
import { calculateArmySize, applyTroopLoss } from '../../engine/combat/combatCalculations';

type Params = {
  armies: Army[];
  provinces: Province[];
  countries: Country[];
  wars: War[];
  currentActiveBattles: ActiveBattle[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  snapshot: { date: GameDate };
  playerCountryTag: string;
  allCountries: Country[];
  addLog: (msg: string) => void;
  addToast: (msg: string, type: any, title?: string, date?: string) => void;
  setActiveBattles: any;
  setArmies: any;
  setBattleHistory: any;
  setBattleReport: any;
  setIsPaused: any;
  activeBattlesRef: React.MutableRefObject<ActiveBattle[]>;
  cancelProvinceActivities: (provinceId: string, oldOwner: string, newOwner: string, rec: Recruitment[], cons: BuildingConstruction[], provs: Province[]) => any;
};

export function processBattleContinuous(p: Params) {
  let { armies, provinces, countries, wars, currentActiveBattles, recruitments, buildingConstructions } = p;
  const { snapshot, playerCountryTag, addLog, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef, cancelProvinceActivities } = p;

  const finishedBattles: ActiveBattle[] = [];
  const stillActiveBattles: ActiveBattle[] = [];

  for (const battle of currentActiveBattles) {
    const province = provinces.find(pr => pr.id === battle.provinceId);
    const attacker = armies.find(a => a.id === battle.attackerArmyId);
    const defender = armies.find(a => a.id === battle.defenderArmyId);
    if (!province ||!attacker ||!defender) {
      stillActiveBattles.push(battle);
      continue;
    }
    const result = processDailyBattle(battle, attacker, defender, province);
    armies = armies.map(a => {
      if (a.id === attacker.id) return result.attacker;
      if (a.id === defender.id) return result.defender;
      if (battle.participantArmyIds.includes(a.id)) {
        const entryDay = (battle as any).reinforcementEntryDay?.[a.id];
        const daysSinceEntry = entryDay!== undefined? (battle.daysTotal - battle.daysRemaining - entryDay) : 10;
        const isFresh = daysSinceEntry < 2;
        const lossRate = isFresh? 0.02 : 0.04;
        const dailyLoss = Math.floor(calculateArmySize(a) * lossRate);
        return applyTroopLoss(a, dailyLoss);
      }
      return a;
    });
    if (result.finished) finishedBattles.push(result.battle);
    else stillActiveBattles.push(result.battle);
  }

  currentActiveBattles = stillActiveBattles;
  activeBattlesRef.current = currentActiveBattles;
  setActiveBattles(currentActiveBattles);

  for (const fb of finishedBattles) {
    const province = provinces.find(pr => pr.id === fb.provinceId);
    const attacker = armies.find(a => a.id === fb.attackerArmyId);
    const defender = armies.find(a => a.id === fb.defenderArmyId);
    if (!province ||!attacker ||!defender) continue;

    const reinfSizes = (fb as any).reinforcementInitialSize || {};
    let attackerReinfInitial = 0;
    let defenderReinfInitial = 0;

    Object.keys(reinfSizes).forEach((id: string) => {
      const size = reinfSizes[id] as number;
      const originalArmy = p.armies.find(a => a.id === id);
      const armyNow = armies.find(a => a.id === id);
      const owner = originalArmy?.owner || armyNow?.owner || '';
      if (owner === attacker.owner) attackerReinfInitial += size;
      else if (owner === defender.owner) defenderReinfInitial += size;
    });

    const totalAttackerInitial = fb.attackerInitialTroops + attackerReinfInitial;
    const totalDefenderInitial = fb.defenderInitialTroops + defenderReinfInitial;

      const { result: finalResult, updatedArmies: rawUpdatedArmies } = finalizeBattle(fb, attacker, defender, province, snapshot.date, armies, provinces, countries);

    const allPartIds = (fb as any).participantArmyIds || [fb.attackerArmyId, fb.defenderArmyId];
    const isStackwipe = (finalResult as any).isStackwipe;

    let realAttackerFinal = 0;
    let realDefenderFinal = 0;
    const participantDetails: any[] = [];

    allPartIds.forEach((id: string) => {
      const finalArmy = rawUpdatedArmies.find(a => a.id === id);
      if (!finalArmy) return;
      const initial = (reinfSizes as any)[id] || (id === fb.attackerArmyId? fb.attackerInitialTroops : id === fb.defenderArmyId? fb.defenderInitialTroops : 0);

      // SE DEU STACKWIPE, FORÇA 0 NO PERDEDOR
      let finalSize = calculateArmySize(finalArmy);
      const isLoserArmy = finalArmy.owner === ((finalResult as any).winner === 'attacker'? defender.owner : attacker.owner);
      if (isStackwipe && isLoserArmy) {
        finalSize = 0;
      }

      participantDetails.push({
        id,
        name: finalArmy.name,
        owner: finalArmy.owner,
        side: finalArmy.owner === attacker.owner? 'attacker' : 'defender',
        initial,
        final: finalSize,
        loss: Math.max(0, initial - finalSize)
      });
      if (finalArmy.owner === attacker.owner) realAttackerFinal += finalSize;
      else realDefenderFinal += finalSize;
    });

    const enrichedResult = {
   ...finalResult,
      totalAttackerInitial,
      totalDefenderInitial,
      attackerReinfInitial,
      defenderReinfInitial,
      attackerCurrentTroops: realAttackerFinal,
      defenderCurrentTroops: realDefenderFinal,
      participantDetails,
      reinforcementInitialSize: reinfSizes
    } as any;

    // LIMPA EXÉRCITOS ANIQUILADOS DO MAPA
    const updatedArmies = rawUpdatedArmies.filter(a => {
      if (!allPartIds.includes(a.id)) return true;
      const detail = participantDetails.find(d => d.id === a.id);
      return detail? detail.final > 0 : calculateArmySize(a) > 0;
    });

    armies = updatedArmies;

    const remainingDefenders = armies.filter(a => a.location === province.id && a.owner === defender.owner &&!a.inCombat && calculateArmySize(a) > 0);

    if (enrichedResult.winner === 'attacker' && remainingDefenders.length === 0) {
      const oldOwner = province.owner;
      const rebelReturnOwner = checkRebelTerritoryReturn(attacker);
      const newProvinceOwner = rebelReturnOwner || attacker.owner;
      provinces = provinces.map(pr => {
        if (pr.id === province.id) {
          const isLiberation =!!rebelReturnOwner;
          const conqueredProvince = isLiberation? {...pr, owner: newProvinceOwner, unrest: 0 } : applyConquestUnrest({...pr, owner: newProvinceOwner }, snapshot.date);
          return {...conqueredProvince, originalOwner: (conqueredProvince as any).originalOwner || oldOwner };
        }
        return pr;
      });
      countries = countries.map(c => {
        if (c.tag === newProvinceOwner) return {...c, provinces: [...c.provinces, province.id] };
        if (c.tag === oldOwner) return {...c, provinces: c.provinces.filter(pid => pid!== province.id) };
        return c;
      });
      const cancelResult = cancelProvinceActivities(province.id, oldOwner, attacker.owner, recruitments, buildingConstructions, provinces);
      recruitments = cancelResult.recruitments;
      buildingConstructions = cancelResult.constructions;
      provinces = cancelResult.provinces;
      const updatedFinalResult = {...enrichedResult, territoryChanged: true, newOwner: newProvinceOwner } as any;
      addLog(`⚔️ ${attacker.owner} conquistou ${province.name} de ${oldOwner}!`);
      setBattleHistory((prev: any) => [updatedFinalResult,...prev]);
      if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
        setBattleReport(updatedFinalResult);
        setIsPaused(true);
      }
    } else {
      if (enrichedResult.winner === 'defender') addLog(`🛡️ ${defender.owner} defendeu ${province.name}!`);
      else addLog(`🛡️ ${attacker.owner} venceu, mas ${defender.owner} ainda tem tropas em ${province.name}!`);
      setBattleHistory((prev: any) => [enrichedResult,...prev]);
      if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
        setBattleReport(enrichedResult);
        setIsPaused(true);
      }
    }

    const winnerCountry = enrichedResult.winner === 'attacker'? enrichedResult.attacker.owner : enrichedResult.defender.owner;
    const loserCountry = enrichedResult.winner === 'attacker'? enrichedResult.defender.owner : enrichedResult.attacker.owner;
    countries = countries.map(c => {
      if (c.tag === winnerCountry) return applyStabilityPrestigeChanges(c, 0, 2);
      if (c.tag === loserCountry) return applyStabilityPrestigeChanges(c, 0, -3);
      return c;
    });
  }

  setArmies(armies);
  setActiveBattles(currentActiveBattles);
  activeBattlesRef.current = currentActiveBattles;

  return { armies, provinces, countries, currentActiveBattles, wars, recruitments, buildingConstructions };
}