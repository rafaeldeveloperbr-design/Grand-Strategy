/**
 * battleContinuousTick.ts - 280 linhas - PASSO 4.4
 * Processa batalhas contínuas ativas e finaliza batalhas
 */
import { processDailyBattle, finalizeBattle, findRetreatProvince } from '../../engine/combat';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { applyConquestUnrest } from '../../engine/unrest';
import { applyStabilityPrestigeChanges } from '../../engine/stability';
import type { Army, Province, Country, War, ActiveBattle, CombatResult, Recruitment, BuildingConstruction } from '../../types';
import type { GameDate } from '../../types/date';

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
  const { snapshot, playerCountryTag, allCountries, addLog, addToast, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef, cancelProvinceActivities } = p;

  const finishedBattles: ActiveBattle[] = [];
  const stillActiveBattles: ActiveBattle[] = [];

  for (const battle of currentActiveBattles) {
    const province = provinces.find(pr => pr.id === battle.provinceId);
    const attacker = armies.find(a => a.id === battle.attackerArmyId);
    const defender = armies.find(a => a.id === battle.defenderArmyId);

    if (!province || !attacker || !defender) {
      continue;
    }

    const result = processDailyBattle(battle, attacker, defender, province);

    armies = armies.map(a => {
      if (a.id === attacker.id) return result.attacker;
      if (a.id === defender.id) return result.defender;
      return a;
    });

    if (result.finished) {
      finishedBattles.push(result.battle);
    } else {
      stillActiveBattles.push(result.battle);
    }
  }

  currentActiveBattles = stillActiveBattles;

  for (const finishedBattle of finishedBattles) {
    const province = provinces.find(pr => pr.id === finishedBattle.provinceId);
    const attacker = armies.find(a => a.id === finishedBattle.attackerArmyId);
    const defender = armies.find(a => a.id === finishedBattle.defenderArmyId);

    if (!province || !attacker || !defender) continue;

    const { result: finalResult } = finalizeBattle(finishedBattle, attacker, defender, province, snapshot.date, armies);

    const participantIds = finishedBattle.participantArmyIds;
    const winnerSide = finalResult.winner;
    const winnerCountry = winnerSide === 'attacker' ? finalResult.attacker.owner : finalResult.defender.owner;
    const loserCountry = winnerSide === 'attacker' ? finalResult.defender.owner : finalResult.attacker.owner;

    const updatedArmiesList = armies.map(army => {
      if (!participantIds.includes(army.id)) return army;
      const hasTroops = army.regiments.length > 0 && army.regiments.some(r => r.strength > 0);
      if (!hasTroops) return null;
      const isWinner = army.owner === winnerCountry;
      const isLoser = army.owner === loserCountry;
      if (isWinner) {
        return { ...army, inCombat: false };
      } else if (isLoser) {
        const retreatProvince = findRetreatProvince(army.owner, province, provinces);
        if (retreatProvince) {
          return { ...army, inCombat: false, location: retreatProvince.id };
        } else {
          return null;
        }
      }
      return army;
    }).filter(Boolean) as Army[];

    armies = updatedArmiesList;
    setArmies(updatedArmiesList);

    wars = wars.map(w => {
      if ((w.attacker === attacker.owner && w.defender === defender.owner) ||
          (w.defender === attacker.owner && w.attacker === defender.owner)) {
        const isAttacker = w.attacker === attacker.owner;
        return {
          ...w,
          attackerCasualties: w.attackerCasualties + (isAttacker ? finalResult.attackerCasualties : finalResult.defenderCasualties),
          defenderCasualties: w.defenderCasualties + (isAttacker ? finalResult.defenderCasualties : finalResult.attackerCasualties)
        };
      }
      return w;
    });

    if (finalResult.winner === 'attacker') {
      const remainingDefenders = armies.filter(a => a.location === province.id && a.owner === defender.owner && !a.inCombat);

      if (remainingDefenders.length === 0) {
        const oldOwner = province.owner;
        const rebelReturnOwner = checkRebelTerritoryReturn(attacker);
        const newProvinceOwner = rebelReturnOwner || attacker.owner;

        provinces = provinces.map(pr => {
          if (pr.id === province.id) {
            const isLiberation = !!rebelReturnOwner;
            const conqueredProvince = isLiberation ? { ...pr, owner: newProvinceOwner, unrest: 0 } : applyConquestUnrest({ ...pr, owner: newProvinceOwner }, snapshot.date);
            return { ...conqueredProvince, originalOwner: conqueredProvince.originalOwner || oldOwner };
          }
          return pr;
        });

        countries = countries.map(c => {
          if (c.tag === newProvinceOwner) return { ...c, provinces: [...c.provinces, province.id] };
          if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
          return c;
        });

        const cancelResult = cancelProvinceActivities(province.id, oldOwner, attacker.owner, recruitments, buildingConstructions, provinces);
        recruitments = cancelResult.recruitments;
        buildingConstructions = cancelResult.constructions;
        provinces = cancelResult.provinces;

        const updatedFinalResult = { ...finalResult, territoryChanged: true, newOwner: newProvinceOwner } as any;
        if (rebelReturnOwner) {
          const countryName = allCountries.find(c => c.tag === rebelReturnOwner)?.name || rebelReturnOwner;
          addLog(`🏴 Rebeldes libertaram ${province.name}! Devolvida a ${countryName}!`);
        } else {
          addLog(`⚔️ ${attacker.owner} conquistou ${province.name} de ${oldOwner}!`);
        }
        setBattleHistory((prev: any) => [updatedFinalResult, ...prev]);
        if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
          setBattleReport(updatedFinalResult);
          setIsPaused(true);
        }
      } else {
        const updatedFinalResult = { ...finalResult, territoryChanged: false } as any;
        addLog(`🛡️ ${attacker.owner} venceu a batalha, mas ${defender.owner} ainda defende ${province.name}!`);
        setBattleHistory((prev: any) => [updatedFinalResult, ...prev]);
        if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
          setBattleReport(updatedFinalResult);
          setIsPaused(true);
        }
      }
    } else {
      addLog(`🛡️ ${defender.owner} defendeu ${province.name}!`);
      const retreatProvince = findRetreatProvince(attacker.owner, province, provinces);
      if (retreatProvince && finalResult.attacker.regiments.length > 0) {
        addLog(`🏃 ${attacker.owner} recuou para ${retreatProvince.name}`);
      } else {
        addLog(`💀 ${attacker.owner} aniquilado em ${province.name}`);
      }
      setBattleHistory((prev: any) => [finalResult, ...prev]);
      if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
        setBattleReport(finalResult);
        setIsPaused(true);
      }
    }

    countries = countries.map(c => {
      if (c.tag === winnerCountry) return applyStabilityPrestigeChanges(c, 0, 2);
      if (c.tag === loserCountry) return applyStabilityPrestigeChanges(c, 0, -3);
      return c;
    });

    if (finalResult.territoryChanged) {
      countries = countries.map(c => {
        if (c.tag === winnerCountry) return applyStabilityPrestigeChanges(c, 2, 5);
        if (c.tag === loserCountry) return applyStabilityPrestigeChanges(c, -5, -5);
        return c;
      });
    }
  }

  setActiveBattles(currentActiveBattles);
  activeBattlesRef.current = currentActiveBattles;

  return { armies, provinces, countries, currentActiveBattles, wars, recruitments, buildingConstructions };
}