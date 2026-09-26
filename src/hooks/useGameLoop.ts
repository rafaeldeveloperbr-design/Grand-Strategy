import { useCallback, useEffect } from 'react';
import { provincesData } from '../data/provinces';
import { countries as initialCountries } from '../data/countries';
import { processDailyTick } from '../engine/economy';
import { processEconomyTick } from './gameLoop/economyTick';
import { processMovementTick } from './gameLoop/movementTick';
import { processBattleArrival } from './gameLoop/battleArrivalTick';
import { processBattleContinuous } from './gameLoop/battleContinuousTick';
import {
  processRecruitments,
  processArmyMovement,
} from '../engine/military';
import { resolveBattle, calculateArmySize, checkAllProvinceCombats, findRetreatProvince, applySiegeAnnihilation, startContinuousBattle, processDailyBattle, finalizeBattle } from '../engine/combat';
import { applyStabilityPrestigeChanges } from '../engine/stability';
import { processDailyUnrestDecay, applyConquestUnrest } from '../engine/unrest';
import { processRebelAccumulation, processSeparatistAI, checkRebelTerritoryReturn, ensureSeparatistWars, cleanupSeparatistWars } from '../engine/rebellions';
import { processDailyTechProgress } from '../engine/technology';
import { checkEndGameConditions, calculateGameStats } from '../engine/gameConditions';
import { processDiplomacyTick } from '../engine/diplomacy';
import { processAI, processAIEconomicDecisions } from '../engine/aiEngine';
import { processConstructions } from '../engine/buildings';
import { getBuildingName, getUnitName } from '../utils/translations';
import type { Province, Country, GameDate, Army, Recruitment, CombatResult, BuildingConstruction, ActiveBattle } from '../types';
import type { CountryTechState } from '../types/technology';
import type { DiplomaticRelation, War } from '../types/diplomacy';
import type { AIDifficulty } from '../types/difficulty';
import type { EndGameType, GameStats } from '../engine/gameConditions';

const SPEED_INTERVALS: Record<number, number> = {
  0: 0,
  1: 1000,
  2: 500,
  3: 250,
  4: 125,
  5: 60,
};

type Props = {
  provincesRef: React.MutableRefObject<Province[]>;
  countriesRef: React.MutableRefObject<Country[]>;
  armiesRef: React.MutableRefObject<Army[]>;
  recruitmentsRef: React.MutableRefObject<Recruitment[]>;
  warsRef: React.MutableRefObject<War[]>;
  diplomaticRelationsRef: React.MutableRefObject<DiplomaticRelation[]>;
  dateRef: React.MutableRefObject<GameDate>;
  buildingConstructionsRef: React.MutableRefObject<BuildingConstruction[]>;
  playerTechStateRef: React.MutableRefObject<CountryTechState>;
  botTechStatesRef: React.MutableRefObject<Map<string, CountryTechState>>;
  aiDifficultyRef: React.MutableRefObject<AIDifficulty>;
  activeBattlesRef: React.MutableRefObject<ActiveBattle[]>;
  ceilingLogRef: React.MutableRefObject<Set<string>>;
  gameLoopRef: React.MutableRefObject<number | null>;
  playerCountryTag: string;
  battleHistory: CombatResult[];
  hasTriggeredEndGame: boolean;
  gameSpeed: number;
  isPaused: boolean;
  allCountries: Country[];
  setProvinces: React.Dispatch<React.SetStateAction<Province[]>>;
  setAllCountries: React.Dispatch<React.SetStateAction<Country[]>>;
  setArmies: React.Dispatch<React.SetStateAction<Army[]>>;
  setWars: React.Dispatch<React.SetStateAction<War[]>>;
  setDiplomaticRelations: React.Dispatch<React.SetStateAction<DiplomaticRelation[]>>;
  setRecruitments: React.Dispatch<React.SetStateAction<Recruitment[]>>;
  setBuildingConstructions: React.Dispatch<React.SetStateAction<BuildingConstruction[]>>;
  setPlayerTechState: React.Dispatch<React.SetStateAction<CountryTechState>>;
  setBotTechStates: React.Dispatch<React.SetStateAction<Map<string, CountryTechState>>>;
  setDate: React.Dispatch<React.SetStateAction<GameDate>>;
  setActiveBattles: React.Dispatch<React.SetStateAction<ActiveBattle[]>>;
  setEndGameType: React.Dispatch<React.SetStateAction<EndGameType>>;
  setGameStats: React.Dispatch<React.SetStateAction<GameStats | null>>;
  setHasTriggeredEndGame: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  setBattleHistory: React.Dispatch<React.SetStateAction<CombatResult[]>>;
  setBattleReport: React.Dispatch<React.SetStateAction<CombatResult | null>>;
  addLog: (msg: string) => void;
  addToast: (msg: string, type: any, title?: string, date?: string) => void;
  addAILog: (countryName: string, type: any, message: string, date: string, color: string) => void;
  formatGameDate: (date: GameDate) => string;
};

export function useGameLoop(props: Props) {
  const {
    provincesRef,
    countriesRef,
    armiesRef,
    recruitmentsRef,
    warsRef,
    diplomaticRelationsRef,
    dateRef,
    buildingConstructionsRef,
    playerTechStateRef,
    botTechStatesRef,
    aiDifficultyRef,
    activeBattlesRef,
    ceilingLogRef,
    gameLoopRef,
    playerCountryTag,
    battleHistory,
    hasTriggeredEndGame,
    gameSpeed,
    isPaused,
    allCountries,
    setProvinces,
    setAllCountries,
    setArmies,
    setWars,
    setDiplomaticRelations,
    setRecruitments,
    setBuildingConstructions,
    setPlayerTechState,
    setBotTechStates,
    setDate,
    setActiveBattles,
    setEndGameType,
    setGameStats,
    setHasTriggeredEndGame,
    setIsPaused,
    setBattleHistory,
    setBattleReport,
    addLog,
    addToast,
    addAILog,
    formatGameDate,
  } = props;


  const cancelProvinceActivities = useCallback((
    provinceId: string,
    oldOwner: string,
    newOwner: string,
    currentRecruitments: Recruitment[],
    currentConstructions: BuildingConstruction[],
    currentProvinces: Province[]
  ): { recruitments: Recruitment[]; constructions: BuildingConstruction[]; provinces: Province[] } => {
    // Cancela recrutamentos na província conquistada
    const cancelledRecruitments = currentRecruitments.filter(r => r.provinceId === provinceId);
    const remainingRecruitments = currentRecruitments.filter(r => r.provinceId !== provinceId);

    // Cancela construções na província conquistada
    const cancelledConstructions = currentConstructions.filter(c => c.provinceId === provinceId);
    const remainingConstructions = currentConstructions.filter(c => c.provinceId !== provinceId);

    // 📌 PRESERVA O originalOwner DA PROVÍNCIA (para revoltas separatistas futuras)
    const updatedProvinces = currentProvinces.map(p => {
      if (p.id === provinceId) {
        return {
          ...p,
          originalOwner: p.originalOwner || oldOwner,
        };
      }
      return p;
    });

    // Registra logs de cancelamento
    if (cancelledRecruitments.length > 0) {
      const province = provincesRef.current.find(p => p.id === provinceId);
      const provinceName = province?.name || provinceId;

      cancelledRecruitments.forEach(rec => {
        const unitName = getUnitName(rec.unitType);
        const country = countriesRef.current.find(c => c.tag === oldOwner);

        if (country) {
          addAILog(
            country.name,
            'military',
            `Recrutamento de ${unitName} cancelado em ${provinceName} (província perdida)`,
            formatGameDate(dateRef.current),
            country.color
          );
        }

        addLog(`❌ Recrutamento de ${unitName} cancelado em ${provinceName}`);
      });
    }

    if (cancelledConstructions.length > 0) {
      const province = provincesRef.current.find(p => p.id === provinceId);
      const provinceName = province?.name || provinceId;

      cancelledConstructions.forEach(construction => {
        const buildingName = getBuildingName(construction.buildingType);
        const country = countriesRef.current.find(c => c.tag === oldOwner);

        if (country) {
          addAILog(
            country.name,
            'building',
            `Construção de ${buildingName} cancelada em ${provinceName} (província perdida)`,
            formatGameDate(dateRef.current),
            country.color
          );
        }

        addLog(`❌ Construção de ${buildingName} cancelada em ${provinceName}`);
      });
    }

    return {
      recruitments: remainingRecruitments,
      constructions: remainingConstructions,
      provinces: updatedProvinces
    };
  }, [addLog, addAILog, formatGameDate]);

  // === Game Loop ===
  const advanceDate = useCallback((currentDate: GameDate): GameDate => {
    let { day, month, year } = currentDate;
    day++;
    if (day > 30) { day = 1; month++; }
    if (month > 12) { month = 1; year++; }
    return { day, month, year };
  }, []);

  /**
   * Processa um tick completo do jogo - ARQUITETURA REFACTORADA
   * Usa apenas atualizações funcionais para evitar stale closures.
   * Todo o processamento é feito em variáveis locais e aplicado de uma vez no final.
   */
  const processTick = useCallback(() => {
    // Lê o snapshot atual de TODOS os estados de uma vez
    const snapshot = {
      provinces: provincesRef.current,
      countries: countriesRef.current,
      armies: armiesRef.current,
      recruitments: recruitmentsRef.current,
      wars: warsRef.current,
      relations: diplomaticRelationsRef.current,
      date: dateRef.current,
      buildingConstructions: buildingConstructionsRef.current,
    };

    // Trabalha com cópias mutáveis locais
    let armies = [...snapshot.armies];
    let provinces = [...snapshot.provinces];
    let countries = [...snapshot.countries];
    let wars = [...snapshot.wars];
    let relations = [...snapshot.relations];
    let recruitments = [...snapshot.recruitments];
    let buildingConstructions = [...snapshot.buildingConstructions];
    let currentActiveBattles = [...activeBattlesRef.current];


    const movementResult = processMovementTick({ armies, provinces, relations, countries, addLog });
    armies = movementResult.armies;
    provinces = movementResult.provinces;
    countries = movementResult.countries;
    const arrivedArmies = movementResult.arrivedArmies;


    // PASSO C.1 + C.2 - chegada e combate automático (230 linhas)
const arrivalResult = processBattleArrival({
  arrivedArmies, armies, provinces, countries, wars,
  recruitments, buildingConstructions, currentActiveBattles,
  snapshot, playerCountryTag, allCountries,
  activeBattlesRef, addLog, addToast, setActiveBattles,
  cancelProvinceActivities
});
armies = arrivalResult.armies;
provinces = arrivalResult.provinces;
countries = arrivalResult.countries;
currentActiveBattles = arrivalResult.currentActiveBattles;
recruitments = arrivalResult.recruitments;
buildingConstructions = arrivalResult.buildingConstructions;

// PASSO C.3 - batalhas contínuas (280 linhas)
const continuousResult = processBattleContinuous({
  armies, provinces, countries, wars, currentActiveBattles,
  recruitments, buildingConstructions, snapshot,
  playerCountryTag, allCountries, addLog, addToast,
  setActiveBattles, setArmies, setBattleHistory, setBattleReport,
  setIsPaused, activeBattlesRef, cancelProvinceActivities
});
armies = continuousResult.armies;
provinces = continuousResult.provinces;
countries = continuousResult.countries;
currentActiveBattles = continuousResult.currentActiveBattles;
wars = continuousResult.wars;
recruitments = continuousResult.recruitments;
buildingConstructions = continuousResult.buildingConstructions;


    // ===== PASSO A + A.5 + D - extraído para economyTick (148 linhas) =====
    const economyResult = processEconomyTick({
      recruitments, armies, countries, provinces, buildingConstructions,
      playerCountryTag, date: snapshot.date, allCountries,
      addToast, addAILog, addLog, formatGameDate
    });
    recruitments = economyResult.recruitments;
    armies = economyResult.armies;
    provinces = economyResult.provinces;
    buildingConstructions = economyResult.buildingConstructions;
    countries = economyResult.countries;

    // ===== PASSO D.5: AGITAÇÃO PROVINCIAL E REVOLTAS =====
    const { updatedProvinces: provincesWithDecay, revoltedProvinces } =
      processDailyUnrestDecay(provinces, snapshot.date, armies);
    provinces = provincesWithDecay;

    // Processa revoltas com ACÚMULO de tropas (1.000 por ciclo)
    if (revoltedProvinces.length > 0) {
      const revoltedProvIds = revoltedProvinces.map(p => p.id);
      const rebelResult = processRebelAccumulation(provinces, armies, revoltedProvIds);

      armies = rebelResult.updatedArmies;
      provinces = rebelResult.updatedProvinces;

      // 🚀 PROCESSA IA SEPARATISTA IMEDIATAMENTE (mesmo tick)
      armies = processSeparatistAI(armies, provinces);

      // Notificações de revolta
      for (const revoltedProv of revoltedProvinces) {
        console.log(`🔥 Revolta em ${revoltedProv.name}! Rebeldes acumulando forças.`);
        addLog(`🔥 Revolta em ${revoltedProv.name}! Rebeldes acumulando forças.`);
        addToast(
          `Revolta em ${revoltedProv.name}! Rebeldes acumulando forças.`,
          'error',
          'Revolta!'
        );
      }

      // Notificações de ativação separatista (5.000 tropas)
      rebelResult.notifications.forEach(notif => {
        addToast(notif, 'warning', 'Separatismo Ativado');
        addLog(notif);
      });

      rebelResult.logs.forEach(log => {
        console.log(log);
      });
    }

    // ===== PASSO D.6: PAZ AUTOMÁTICA POR ANEXAÇÃO TOTAL =====
    // Verifica se algum país perdeu todas as províncias (e ainda não foi marcado como anexado)
    const countriesWithoutProvinces = countries.filter(c => {
      // Ignora países já marcados como anexados
      if (c.isAnnexed) return false;

      const ownedProvinces = provinces.filter(p => p.owner === c.tag);
      return ownedProvinces.length === 0 && c.tag !== playerCountryTag;
    });

    if (countriesWithoutProvinces.length > 0) {
      for (const defeatedCountry of countriesWithoutProvinces) {
        // Marca o país como anexado para NÃO processar novamente
        countries = countries.map(c =>
          c.tag === defeatedCountry.tag ? { ...c, isAnnexed: true } : c
        );

        console.log(`🏳️ ${defeatedCountry.name} foi totalmente anexado!`);
        addLog(`🏳️ ${defeatedCountry.name} foi totalmente anexado!`);
        addToast(
          `${defeatedCountry.name} foi totalmente anexado!`,
          'warning',
          'Anexação Total'
        );

        // Encerra todas as guerras envolvendo este país
        wars = wars.filter(w =>
          w.attacker !== defeatedCountry.tag && w.defender !== defeatedCountry.tag
        );

        // Remove relações diplomáticas
        relations = relations.filter(r =>
          r.countryA !== defeatedCountry.tag && r.countryB !== defeatedCountry.tag
        );
      }
    }

    // ===== PASSO E: DIPLOMACIA =====
    relations = processDiplomacyTick(relations);

    // ===== PASSO E.5: TECNOLOGIAS E FOCOS =====
    // Usa a ref para garantir que está usando o estado mais recente (não o estado do React que pode estar desatualizado)
    let currentPlayerTechState = playerTechStateRef.current;

    // Processa progresso de tecnologias do jogador
    const playerCountry = countries.find(c => c?.tag === playerCountryTag);
    if (currentPlayerTechState && playerCountry) {
      const playerTechResult = processDailyTechProgress(currentPlayerTechState, playerCountry, aiDifficultyRef.current, true);
      currentPlayerTechState = playerTechResult.techState;

      // Atualiza a ref imediatamente com o novo estado
      playerTechStateRef.current = currentPlayerTechState;

      if (playerTechResult.notifications?.length > 0) {
        const dateString = formatGameDate(snapshot.date);
        playerTechResult.notifications.forEach(notif => {
          addLog(notif);

          // Dispara toast para conclusões
          if (notif.includes('Foco concluído')) {
            addToast(notif.replace('✅ ', ''), 'success', 'Foco Concluído', dateString);
          } else if (notif.includes('Pesquisa concluída')) {
            addToast(notif.replace('🔬 ', ''), 'success', 'Tecnologia Desenvolvida', dateString);
          }
        });
      }
    }

    // Processa progresso de tecnologias dos bots
    let currentBotTechStates = new Map(botTechStatesRef.current);
    countries.forEach(country => {
      if (country?.tag && country.tag !== playerCountryTag) {
        const botTechState = currentBotTechStates.get(country.tag);
        if (botTechState) {
          const botTechResult = processDailyTechProgress(botTechState, country, aiDifficultyRef.current, false);
          currentBotTechStates.set(country.tag, botTechResult.techState);

          // Registra notificações de conclusão no log da IA (apenas quando conclui, não diariamente)
          if (botTechResult.notifications?.length > 0) {
            const dateString = formatGameDate(snapshot.date);
            botTechResult.notifications.forEach(notif => {
              addLog(`🤖 ${country.name}: ${notif}`);

              // Registra no log da IA
              if (notif.includes('Foco concluído')) {
                const focusTitle = notif.replace('✅ Foco concluído: ', '');
                addAILog(
                  country.name,
                  'focus',
                  `Foco Nacional "${focusTitle}" concluído`,
                  dateString,
                  country.color
                );
              } else if (notif.includes('Pesquisa concluída')) {
                const techTitle = notif.replace('🔬 Pesquisa concluída: ', '');
                addAILog(
                  country.name,
                  'tech',
                  `Tecnologia "${techTitle}" pesquisada`,
                  dateString,
                  country.color
                );
              }
            });
          }
        }
      }
    });

    // Atualiza a ref dos bots imediatamente
    botTechStatesRef.current = currentBotTechStates;

    // ===== PASSO F: ATUALIZA WAR SCORE =====
    wars = wars.map(war => {
      const attackerProvs = provinces.filter(p => p.owner === war.attacker).length;
      const defenderProvs = provinces.filter(p => p.owner === war.defender).length;
      return { ...war, warScore: attackerProvs - defenderProvs };
    });

    // ===== PASSO G: IA DOS BOTS =====
    // Para cada bot ativo, processa decisões econômicas e movimentação militar
    const activeBots = countries.filter((c: Country) => c && c.tag !== playerCountryTag);
    const dateString = formatGameDate(snapshot.date);

    activeBots.forEach((country: Country) => {
      // G.1: Decisões Econômicas (construir, recrutar, pesquisar, focos)
      const botTechState = currentBotTechStates.get(country.tag);
      if (botTechState) {
        // 🎯 TETO MILITAR (rubber-band): bot muito à frente do player para de recrutar
        const playerTroops = armies
          .filter(a => a.owner === playerCountryTag)
          .reduce((sum, a) => sum + calculateArmySize(a), 0);
        const botTroops = armies
          .filter(a => a.owner === country.tag)
          .reduce((sum, a) => sum + calculateArmySize(a), 0);
        const botAtWar = wars.some(w => w.attacker === country.tag || w.defender === country.tag);
        const multiplier = botAtWar ? 3 : 2;            // em guerra, teto mais alto
        const ceiling = Math.max(12000, playerTroops * multiplier); // piso p/ early game
        const canRecruitMilitary = botTroops < ceiling;

        if (!canRecruitMilitary) {
          if (!ceilingLogRef.current.has(country.tag)) {
            ceilingLogRef.current.add(country.tag);
            console.log(`🎯 Teto militar: ${country.name} (${Math.floor(botTroops)} tropas) atingiu o teto (${Math.floor(ceiling)}) → recrutamento PAUSADO`);
          }
        } else if (ceilingLogRef.current.has(country.tag)) {
          ceilingLogRef.current.delete(country.tag);
          console.log(`✅ Teto militar liberado: ${country.name} voltou a recrutar`);
        }

        const economicResult = processAIEconomicDecisions(
          country,
          provinces,
          botTechState,
          buildingConstructions,
          recruitments,
          dateString,
          canRecruitMilitary
        );
        // Atualiza estados
        countries = countries.map(c => c.tag === country.tag ? economicResult.country : c);
        currentBotTechStates.set(country.tag, economicResult.techState);
        buildingConstructions = economicResult.buildingConstructions;
        recruitments = economicResult.recruitments;

        // Registra logs da IA
        economicResult.logs.forEach((log: { actionType: 'building' | 'military' | 'tech' | 'focus'; message: string }) => {
          addAILog(
            country.name,
            log.actionType,
            log.message,
            dateString,
            country.color
          );
        });
      }

      // G.2: Movimentação Militar
      const armiesBefore = armies.filter(a => a.owner === country.tag);
      armies = processAI(country.tag, armies, provinces, relations, wars);
      const armiesAfter = armies.filter(a => a.owner === country.tag);

      // Registra no log da IA se algum exército se moveu
      armiesAfter.forEach(armyAfter => {
        const armyBefore = armiesBefore.find(a => a.id === armyAfter.id);
        if (armyBefore && armyBefore.destination === null && armyAfter.destination !== null) {
          const destProvince = provinces.find(p => p.id === armyAfter.destination);
          if (destProvince) {
            const isEnemy = destProvince.owner !== country.tag;
            addAILog(
              country.name,
              'military',
              `Exército moveu para ${destProvince.name}${isEnemy ? ' (território inimigo)' : ''}`,
              dateString,
              country.color
            );
          }
        }
      });
    });

    // Atualiza a ref dos bots com as novas decisões econômicas
    botTechStatesRef.current = currentBotTechStates;

    // ===== PASSO H: FUSÃO AUTOMÁTICA DE EXÉRCITOS DA IA =====
    // Fusão física de exércitos da mesma nação na mesma província
    const armiesToMerge = new Map<string, Army[]>(); // provinceId -> armies

    // Agrupa exércitos da IA por província
    for (const army of armies) {
      if (army.owner === playerCountryTag) continue; // Ignora exércitos do jogador
      if (!army.location) continue;

      const key = `${army.owner}_${army.location}`;
      if (!armiesToMerge.has(key)) {
        armiesToMerge.set(key, []);
      }
      armiesToMerge.get(key)!.push(army);
    }

    // Funde exércitos quando há 2+ na mesma província
    for (const [key, armiesInProvince] of armiesToMerge) {
      if (armiesInProvince.length < 2) continue;

      const [primaryArmy, ...secondaryArmies] = armiesInProvince;

      // Soma todos os regimentos dos exércitos secundários ao primário
      const mergedRegiments = [...primaryArmy.regiments];
      for (const secondaryArmy of secondaryArmies) {
        for (const regiment of secondaryArmy.regiments) {
          // Tenta encontrar regimento do mesmo tipo para somar
          const existingRegiment = mergedRegiments.find(r => r.type === regiment.type);
          if (existingRegiment) {
            existingRegiment.strength += regiment.strength;
            existingRegiment.morale = (existingRegiment.morale + regiment.morale) / 2;
          } else {
            mergedRegiments.push({ ...regiment });
          }
        }
      }

      // Atualiza o exército primário com os regimentos fundidos
      const updatedPrimaryArmy = {
        ...primaryArmy,
        regiments: mergedRegiments,
        targetArmyId: null // Limpa target lock após fusão
      };

      // Remove exércitos secundários e atualiza o primário
      const secondaryIds = secondaryArmies.map(a => a.id);
      armies = armies.filter(a => !secondaryIds.includes(a.id));
      armies = armies.map(a => a.id === primaryArmy.id ? updatedPrimaryArmy : a);

      console.log(`🔀 [MERGE] ${primaryArmy.owner} fundiu ${secondaryArmies.length + 1} exércitos em ${primaryArmy.location}`);
    }


    // ===== PASSO H.5: IA SEPARATISTA (REBELDES EM MARCHA DE RECONQUISTA) =====
    armies = processSeparatistAI(armies, provinces);


    // ===== PASSO H.6: BATALHAS PENDENTES COM REBELDES =====
    // Garante combate quando rebelde e inimigo estão parados na mesma província
    for (const prov of provinces) {
      const armiesHere = armies.filter(a => a.location === prov.id && !a.inCombat && !a.destination);
      if (armiesHere.length < 2) continue;

      const rebelSide = armiesHere.filter(a => a.owner.startsWith('rebel_'));
      if (rebelSide.length === 0) continue;

      const existingBattle = currentActiveBattles.find((b: ActiveBattle) => b.provinceId === prov.id);
      if (existingBattle) continue;

      const origOwner = rebelSide[0].originalOwner;
      const hostileSide = armiesHere.filter(a => !a.owner.startsWith('rebel_') && a.owner !== origOwner);
      if (hostileSide.length === 0) continue;

      const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newBattle = startContinuousBattle(rebelSide, hostileSide, prov, snapshot.date, battleId);
      const participantIds = newBattle.participantArmyIds;
      armies = armies.map(a => participantIds.includes(a.id) ? { ...a, inCombat: true } : a);
      currentActiveBattles = [...currentActiveBattles, newBattle];

      addLog(`⚔️ Batalha iniciada em ${prov.name}: rebeldes vs ${hostileSide[0].owner}!`);
      if (prov.owner === playerCountryTag || hostileSide[0].owner === playerCountryTag) {
        addToast(`Rebeldes atacam ${prov.name}!`, 'warning', 'Batalha Iniciada');
      }
    }
    setActiveBattles(currentActiveBattles);
    activeBattlesRef.current = currentActiveBattles;


    // ===== PASSO H.7: GUERRA AUTOMÁTICA DOS SEPARATISTAS =====
    const warResult = ensureSeparatistWars(armies, provinces, wars, relations, snapshot.date);
    if (warResult.newConflicts.length > 0) {
      wars = warResult.wars;
      relations = warResult.relations;
      for (const conflict of warResult.newConflicts) {
        console.log(`📯 GUERRA DE RECONQUISTA DECLARADA: ${conflict}`);
        addLog(`📯 Guerra de Reconquista: ${conflict}!`);
      }
      addToast(
        '⚠️ Rebeldes separatistas declararam guerra de reconquista!',
        'warning',
        'Guerra Declarada'
      );
    }

    // ===== PASSO H.8: FIM DA GUERRA SEPARATISTA (PAZ E CELEBRAÇÃO) =====
    const cleanupResult = cleanupSeparatistWars(armies, provinces, wars, relations);
    if (cleanupResult.endedWars.length > 0 || cleanupResult.pacifiedProvinces.length > 0) {
      wars = cleanupResult.wars;
      relations = cleanupResult.relations;
      provinces = cleanupResult.provinces;

      cleanupResult.endedWars.forEach(w => {
        console.log(`🕊️ Guerra separatista encerrada: ${w} → PAZ`);
        addLog(`🕊️ A guerra de reconquista terminou. A paz foi restaurada!`);
      });

      if (cleanupResult.pacifiedProvinces.length > 0) {
        addToast(
          `🎉 Reconquista concluída! ${cleanupResult.pacifiedProvinces.length} província(s) celebram em paz.`,
          'success',
          'Paz Restaurada'
        );
      }
    }


    // ===== PASSO I: VERIFICA CONDIÇÕES DE FIM DE JOGO =====
    if (!hasTriggeredEndGame) {
      const playerCountryData = countries.find(c => c.tag === playerCountryTag);
      if (playerCountryData) {
        const endGameResult = checkEndGameConditions(playerCountryData, provinces);

        if (endGameResult !== null) {
          console.log(`🏁 FIM DE JOGO DETECTADO: ${endGameResult.toUpperCase()}`);

          // Calcula estatísticas da partida
          const stats = calculateGameStats(
            { year: 1444, month: 11, day: 11 }, // Data inicial
            dateRef.current,
            battleHistory,
            playerCountryTag,
            provinces
          );

          setEndGameType(endGameResult);
          setGameStats(stats);
          setHasTriggeredEndGame(true);
          setIsPaused(true);

          addLog(`🏁 ${endGameResult === 'victory' ? 'VITÓRIA!' : 'DERROTA!'} Jogo encerrado.`);
        }
      }
    }

    // ===== APLICA TODAS AS ATUALIZAÇÕES DE UMA VEZ =====
    setArmies(armies);
    setProvinces(provinces);
    setAllCountries(countries);
    setWars(wars);
    setDiplomaticRelations(relations);
    setRecruitments(recruitments);
    setBuildingConstructions(buildingConstructions);
    setPlayerTechState(currentPlayerTechState);
    setBotTechStates(currentBotTechStates);
    setDate(prevDate => advanceDate(prevDate));

    // Atualiza refs para o próximo tick
    armiesRef.current = armies;
    provincesRef.current = provinces;
    countriesRef.current = countries;
    warsRef.current = wars;
    diplomaticRelationsRef.current = relations;
    recruitmentsRef.current = recruitments;
    activeBattlesRef.current = currentActiveBattles;
    buildingConstructionsRef.current = buildingConstructions;
    playerTechStateRef.current = currentPlayerTechState;
    botTechStatesRef.current = currentBotTechStates;
  }, [addLog, playerCountryTag]);

  /**
   * Gerencia o game loop
   */
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    // Não inicia o loop se estiver pausado
    if (gameSpeed > 0 && !isPaused) {
      const interval = SPEED_INTERVALS[gameSpeed];
      gameLoopRef.current = window.setInterval(processTick, interval);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameSpeed, processTick, isPaused]);
}
