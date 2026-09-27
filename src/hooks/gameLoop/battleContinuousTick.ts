/**
 * battleContinuousTick.ts - PASSO 4.4
 * Processa batalhas contínuas ativas e finaliza batalhas
 */
import { processDailyBattle, finalizeBattle, findRetreatProvince } from '../../engine/combat';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { applyConquestUnrest } from '../../engine/unrest';
import { applyStabilityPrestigeChanges } from '../../engine/stability';
import type { Army, Province, Country, War, ActiveBattle, CombatResult, Recruitment, BuildingConstruction } from '../../types';
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
  const { snapshot, playerCountryTag, allCountries, addLog, addToast, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef, cancelProvinceActivities } = p;

  const finishedBattles: ActiveBattle[] = [];
  const stillActiveBattles: ActiveBattle[] = [];

  for (const battle of currentActiveBattles) {
    const province = provinces.find(pr => pr.id === battle.provinceId);
    const attacker = armies.find(a => a.id === battle.attackerArmyId);
    const defender = armies.find(a => a.id === battle.defenderArmyId);

    if (!province || !attacker || !defender) {
      stillActiveBattles.push(battle); // não apaga se não achar
      continue;
    }

    const result = processDailyBattle(battle, attacker, defender, province);

    // CORREÇÃO: Atualiza todos os participantes com baixa proporcional
    // O processDailyBattle já atualizou attacker/defender principais
    // Reforços perdem proporcional também
    armies = armies.map(a => {
      if (a.id === attacker.id) return result.attacker;
      if (a.id === defender.id) return result.defender;
      if (battle.participantArmyIds.includes(a.id)) {
        // Reforço perde 6% também por dia
        const dailyLoss = Math.floor(calculateArmySize(a) * 0.06);
        return applyTroopLoss(a, dailyLoss);
      }
      return a;
    });

    if (result.finished) {
      finishedBattles.push(result.battle);
    } else {
      stillActiveBattles.push(result.battle);
    }
  }

  // Atualiza batalhas ativas antes de finalizar
  currentActiveBattles = stillActiveBattles;
  activeBattlesRef.current = currentActiveBattles;
  setActiveBattles(currentActiveBattles);

  for (const finishedBattle of finishedBattles) {
    const province = provinces.find(pr => pr.id === finishedBattle.provinceId);
    const attacker = armies.find(a => a.id === finishedBattle.attackerArmyId);
    const defender = armies.find(a => a.id === finishedBattle.defenderArmyId);

    if (!province || !attacker || !defender) continue;

    // finalizeBattle já libera TODO MUNDO, inclusive o 15k
    const { result: finalResult, updatedArmies } = finalizeBattle(finishedBattle, attacker, defender, province, snapshot.date, armies);

    // USA O updatedArmies QUE VEM DO FINALIZER, não cria outro
    armies = updatedArmies;

    // Conquista de território só se não tem mais defensores
    const remainingDefenders = armies.filter(a => 
      a.location === province.id && 
      a.owner === defender.owner && 
      !a.inCombat &&
      calculateArmySize(a) > 0
    );

    if (finalResult.winner === 'attacker' && remainingDefenders.length === 0) {
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
      addLog(`⚔️ ${attacker.owner} conquistou ${province.name} de ${oldOwner}!`);
      setBattleHistory((prev: any) => [updatedFinalResult, ...prev]);
      if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
        setBattleReport(updatedFinalResult);
        setIsPaused(true);
      }
    } else {
      if (finalResult.winner === 'defender') {
        addLog(`🛡️ ${defender.owner} defendeu ${province.name}!`);
      } else {
        addLog(`🛡️ ${attacker.owner} venceu, mas ${defender.owner} ainda tem tropas em ${province.name}!`);
      }
      setBattleHistory((prev: any) => [finalResult, ...prev]);
      if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
        setBattleReport(finalResult);
        setIsPaused(true);
      }
    }

    // Estabilidade
    const winnerCountry = finalResult.winner === 'attacker' ? finalResult.attacker.owner : finalResult.defender.owner;
    const loserCountry = finalResult.winner === 'attacker' ? finalResult.defender.owner : finalResult.attacker.owner;
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