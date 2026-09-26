/**
 * battleArrivalTick.ts - 230 linhas - PASSO 4.3
 * Chegada de exércitos + detecção automática de combate
 */
import { checkAllProvinceCombats, startContinuousBattle, calculateArmySize } from '../../engine/combat';
import { applyConquestUnrest } from '../../engine/unrest';
import type { Army, Province, Country, War, ActiveBattle } from '../../types';
import type { GameDate } from '../../types/date';
import type { Recruitment, BuildingConstruction } from '../../types';

type Params = {
  arrivedArmies: Army[];
  armies: Army[];
  provinces: Province[];
  countries: Country[];
  wars: War[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  currentActiveBattles: ActiveBattle[];
  snapshot: { date: GameDate };
  playerCountryTag: string;
  allCountries: Country[];
  activeBattlesRef: React.MutableRefObject<ActiveBattle[]>;
  addLog: (msg: string) => void;
  addToast: (msg: string, type: any, title?: string, date?: string) => void;
  setActiveBattles: any;
  cancelProvinceActivities: (provinceId: string, oldOwner: string, newOwner: string, rec: Recruitment[], cons: BuildingConstruction[], provs: Province[]) => any;
};

export function processBattleArrival(p: Params) {
  let { arrivedArmies, armies, provinces, countries, wars, recruitments, buildingConstructions, currentActiveBattles } = p;
  const { snapshot, playerCountryTag, allCountries, activeBattlesRef, addLog, addToast, setActiveBattles, cancelProvinceActivities } = p;

  // C.1: Processa exércitos que chegaram ao destino
  for (const arrived of arrivedArmies) {
    const province = provinces.find(pr => pr.id === arrived.location);
    if (!province) {
      armies = [...armies, arrived];
      continue;
    }

    const isInWar = wars.some(
      w => (w.attacker === arrived.owner && w.defender === province.owner) ||
           (w.defender === arrived.owner && w.attacker === province.owner)
    );

    const isHostile = (ownerA: string, ownerB: string, origA?: string, origB?: string): boolean => {
      const aRebel = ownerA.startsWith('rebel_');
      const bRebel = ownerB.startsWith('rebel_');
      if (aRebel && bRebel) return false;
      if (aRebel) return ownerB !== (origA || '');
      if (bRebel) return ownerA !== (origB || '');
      return wars.some(
        w => (w.attacker === ownerA && w.defender === ownerB) ||
             (w.defender === ownerA && w.attacker === ownerB)
      );
    };

    const isRebelArrived = arrived.owner.startsWith('rebel_');
    const enemies = armies.filter(a =>
      a.location === province.id &&
      a.id !== arrived.id &&
      isHostile(arrived.owner, a.owner, arrived.originalOwner, a.originalOwner)
    );

    const isRebelAttackingEnemy = isRebelArrived &&
      province.owner !== arrived.owner &&
      province.owner !== (arrived.originalOwner || arrived.owner);

    const shouldBattle = enemies.length > 0 || isRebelAttackingEnemy || isInWar;

    if (province.owner !== arrived.owner && !shouldBattle) {
      armies = [...armies, arrived];
      continue;
    }

    if (enemies.length > 0) {
      const existingBattle = activeBattlesRef.current.find((b: ActiveBattle) => b.provinceId === province.id);

      if (!existingBattle) {
        const attackerArmies = armies.filter(a => a.location === province.id && a.owner === arrived.owner && !a.inCombat);
        const defenderArmies = armies.filter(a => a.location === province.id && a.owner !== arrived.owner && !a.inCombat && isHostile(arrived.owner, a.owner, arrived.originalOwner, a.originalOwner));

        const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newBattle = startContinuousBattle(attackerArmies, defenderArmies, province, snapshot.date, battleId);

        const participantIds = newBattle.participantArmyIds;
        armies = armies.map(a => participantIds.includes(a.id) ? { ...a, inCombat: true } : a);

        setActiveBattles((prev: ActiveBattle[]) => [...prev, newBattle]);

        addLog(`⚔️ Batalha iniciada em ${province.name}! Duração: ${newBattle.daysTotal} dias`);
        if (arrived.owner === playerCountryTag || province.owner === playerCountryTag) {
          addToast(`Batalha iniciada em ${province.name}! ${newBattle.daysTotal} dias de combate.`, 'warning', 'Batalha Iniciada');
        }
      } else {
        armies = [...armies, { ...arrived, inCombat: true }];
      }
      continue;
    }

    armies = [...armies, arrived];

    if (province.owner !== arrived.owner && shouldBattle) {
      const oldOwner = province.owner;
      const newOwner = (isRebelArrived && arrived.originalOwner) ? arrived.originalOwner : arrived.owner;

      provinces = provinces.map(pr => {
        if (pr.id === province.id) {
          const isLiberation = isRebelArrived && newOwner === arrived.originalOwner;
          const conqueredProv = isLiberation ? { ...pr, owner: newOwner, unrest: 0 } : applyConquestUnrest({ ...pr, owner: newOwner }, snapshot.date);
          return { ...conqueredProv, originalOwner: conqueredProv.originalOwner || oldOwner };
        }
        return pr;
      });

      countries = countries.map(c => {
        if (c.tag === newOwner) return { ...c, provinces: [...c.provinces, province.id] };
        if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
        return c;
      });

      const cancelResult = cancelProvinceActivities(province.id, oldOwner, newOwner, recruitments, buildingConstructions, provinces);
      recruitments = cancelResult.recruitments;
      buildingConstructions = cancelResult.constructions;
      provinces = cancelResult.provinces;

      if (isRebelArrived) {
        const countryName = allCountries.find(c => c.tag === newOwner)?.name || newOwner;
        addLog(`🏴 Rebeldes libertaram ${province.name}! Devolvida a ${countryName}`);
      } else {
        addLog(`🏳️ ${arrived.owner} ocupou ${province.name} (sem resistência)`);
      }
    }
  }

  // C.2: Verificação automática de combate em todas as províncias
  const autoCombatResult = checkAllProvinceCombats(armies, provinces, wars, snapshot.date, activeBattlesRef.current);
  armies = autoCombatResult.armies;
  currentActiveBattles = [...autoCombatResult.updatedBattles];

  if (autoCombatResult.newBattles.length > 0) {
    currentActiveBattles = [...currentActiveBattles, ...autoCombatResult.newBattles];
    for (const newBattle of autoCombatResult.newBattles) {
      const province = provinces.find(pr => pr.id === newBattle.provinceId);
      const attacker = armies.find(a => a.id === newBattle.attackerArmyId);
      const defender = armies.find(a => a.id === newBattle.defenderArmyId);
      if (province && attacker && defender) {
        addLog(`⚔️ Batalha iniciada em ${province.name}! Duração: ${newBattle.daysTotal} dias`);
        if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
          addToast(`Batalha iniciada em ${province.name}! ${newBattle.daysTotal} dias de combate.`, 'warning', 'Batalha Iniciada');
        }
      }
    }
  }

  if (autoCombatResult.reinforcementsAdded.length > 0) {
    for (const reinforcement of autoCombatResult.reinforcementsAdded) {
      const sideLabel = reinforcement.side === 'attacker' ? 'atacante' : 'defensor';
      addLog(`⚔️ Reforço: ${reinforcement.armyOwner} enviou ${reinforcement.troops} tropas para ${reinforcement.provinceName} (lado ${sideLabel})`);
      if (reinforcement.armyOwner === playerCountryTag) {
        addToast(`Exército entrou como reforço em ${reinforcement.provinceName}! (+${reinforcement.troops} tropas)`, 'info', 'Reforço Adicionado');
      }
    }
  }

  return { armies, provinces, countries, currentActiveBattles, recruitments, buildingConstructions };
}
