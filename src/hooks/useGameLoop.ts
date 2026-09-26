import { useCallback, useEffect } from 'react';
import type { Province, Country, GameDate, Army, Recruitment, CombatResult, BuildingConstruction, ActiveBattle } from '../types';
import type { CountryTechState } from '../types/technology';
import type { DiplomaticRelation, War } from '../types/diplomacy';
import type { AIDifficulty } from '../types/difficulty';
import type { EndGameType, GameStats } from '../engine/gameConditions';

import { processEconomyTick } from './gameLoop/economyTick';
import { processMovementTick } from './gameLoop/movementTick';
import { processBattleArrival } from './gameLoop/battleArrivalTick';
import { processBattleContinuous } from './gameLoop/battleContinuousTick';
import { processUnrestTick } from './gameLoop/unrestTick';
import { processDiplomacyTechTick } from './gameLoop/diplomacyTechTick';
import { processAiTick } from './gameLoop/aiTick';
import { processRebelTick } from './gameLoop/rebelTick';

const SPEED_INTERVALS: Record<number, number> = { 0: 0, 1: 1000, 2: 500, 3: 250, 4: 125, 5: 60 };

type Props = {
  provincesRef: any; countriesRef: any; armiesRef: any; recruitmentsRef: any; warsRef: any;
  diplomaticRelationsRef: any; dateRef: any; buildingConstructionsRef: any;
  playerTechStateRef: any; botTechStatesRef: any; aiDifficultyRef: any;
  activeBattlesRef: any; ceilingLogRef: any; gameLoopRef: any;
  playerCountryTag: string; battleHistory: CombatResult[]; hasTriggeredEndGame: boolean;
  gameSpeed: number; isPaused: boolean; allCountries: Country[];
  setProvinces: any; setAllCountries: any; setArmies: any; setWars: any;
  setDiplomaticRelations: any; setRecruitments: any; setBuildingConstructions: any;
  setPlayerTechState: any; setBotTechStates: any; setDate: any; setActiveBattles: any;
  setEndGameType: any; setGameStats: any; setHasTriggeredEndGame: any;
  setIsPaused: any; setBattleHistory: any; setBattleReport: any;
  addLog: any; addToast: any; addAILog: any; formatGameDate: any;
};

export function useGameLoop(props: Props) {
  const {
    provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef,
    dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef,
    activeBattlesRef, ceilingLogRef, gameLoopRef, playerCountryTag, battleHistory,
    hasTriggeredEndGame, gameSpeed, isPaused, allCountries, setProvinces, setAllCountries,
    setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions,
    setPlayerTechState, setBotTechStates, setDate, setActiveBattles, setEndGameType,
    setGameStats, setHasTriggeredEndGame, setIsPaused, setBattleHistory, setBattleReport,
    addLog, addToast, addAILog, formatGameDate,
  } = props;

  const cancelProvinceActivities = useCallback((provinceId: string, oldOwner: string, newOwner: string, rec: any, cons: any, provs: any) => {
    return {
      recruitments: rec.filter((r: any) => r.provinceId !== provinceId),
      constructions: cons.filter((c: any) => c.provinceId !== provinceId),
      provinces: provs.map((p: any) => p.id === provinceId ? { ...p, originalOwner: p.originalOwner || oldOwner } : p)
    };
  }, []);

  const advanceDate = useCallback((d: GameDate): GameDate => {
    let { day, month, year } = d; day++; if (day > 30) { day = 1; month++; } if (month > 12) { month = 1; year++; } return { day, month, year };
  }, []);

  const processTick = useCallback(() => {
    const snapshot = {
      provinces: provincesRef.current, countries: countriesRef.current, armies: armiesRef.current,
      recruitments: recruitmentsRef.current, wars: warsRef.current, relations: diplomaticRelationsRef.current,
      date: dateRef.current, buildingConstructions: buildingConstructionsRef.current,
    };

    let armies = [...snapshot.armies], provinces = [...snapshot.provinces], countries = [...snapshot.countries];
    let wars = [...snapshot.wars], relations = [...snapshot.relations], recruitments = [...snapshot.recruitments];
    let buildingConstructions = [...snapshot.buildingConstructions];
    let currentActiveBattles = [...activeBattlesRef.current];
    let currentPlayerTechState = playerTechStateRef.current;
    let currentBotTechStates = new Map<string, CountryTechState>(botTechStatesRef.current);

    const eco = processEconomyTick({ recruitments, armies, countries, provinces, buildingConstructions, playerCountryTag, date: snapshot.date, allCountries, addToast, addAILog, addLog, formatGameDate });
    recruitments = eco.recruitments; armies = eco.armies; provinces = eco.provinces; buildingConstructions = eco.buildingConstructions; countries = eco.countries;

    const mov = processMovementTick({ armies, provinces, relations, countries, addLog });
    armies = mov.armies; provinces = mov.provinces; countries = mov.countries; const arrivedArmies = mov.arrivedArmies;

    const arr = processBattleArrival({ arrivedArmies, armies, provinces, countries, wars, recruitments, buildingConstructions, currentActiveBattles, snapshot, playerCountryTag, allCountries, activeBattlesRef, addLog, addToast, setActiveBattles, cancelProvinceActivities });
    armies = arr.armies; provinces = arr.provinces; countries = arr.countries; currentActiveBattles = arr.currentActiveBattles; recruitments = arr.recruitments; buildingConstructions = arr.buildingConstructions;

    const cont = processBattleContinuous({ armies, provinces, countries, wars, currentActiveBattles, recruitments, buildingConstructions, snapshot, playerCountryTag, allCountries, addLog, addToast, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef, cancelProvinceActivities });
    armies = cont.armies; provinces = cont.provinces; countries = cont.countries; currentActiveBattles = cont.currentActiveBattles; wars = cont.wars; recruitments = cont.recruitments; buildingConstructions = cont.buildingConstructions;

    const unr = processUnrestTick({ provinces, armies, countries, wars, relations, snapshot, playerCountryTag, allCountries, addLog, addToast });
    provinces = unr.provinces; armies = unr.armies; countries = unr.countries; wars = unr.wars; relations = unr.relations;

    const dip = processDiplomacyTechTick({ countries, provinces, armies, wars, relations, playerCountryTag, snapshot, currentPlayerTechState, currentBotTechStates, aiDifficultyRef, playerTechStateRef, botTechStatesRef, addLog, addToast, addAILog, formatGameDate });
    countries = dip.countries; provinces = dip.provinces; armies = dip.armies; wars = dip.wars; relations = dip.relations; currentPlayerTechState = dip.currentPlayerTechState; currentBotTechStates = dip.currentBotTechStates;

    const ai = processAiTick({ countries, provinces, armies, wars, relations, buildingConstructions, recruitments, currentBotTechStates, playerCountryTag, aiDifficultyRef, ceilingLogRef, snapshot, allCountries, addAILog, formatGameDate });
    countries = ai.countries; provinces = ai.provinces; armies = ai.armies; wars = ai.wars; relations = ai.relations; buildingConstructions = ai.buildingConstructions; recruitments = ai.recruitments; currentBotTechStates = ai.currentBotTechStates;

    const reb = processRebelTick({ provinces, armies, countries, wars, relations, currentActiveBattles, snapshot, playerCountryTag, hasTriggeredEndGame, battleHistory, dateRef, addLog, addToast, setActiveBattles, activeBattlesRef, setEndGameType, setGameStats, setHasTriggeredEndGame, setIsPaused });
    provinces = reb.provinces; armies = reb.armies; countries = reb.countries; wars = reb.wars; relations = reb.relations; currentActiveBattles = reb.currentActiveBattles;
    if (reb.endGameTriggered) { setEndGameType(reb.endGameType); setGameStats(reb.gameStats); setHasTriggeredEndGame(true); setIsPaused(true); }

    setArmies(armies); setProvinces(provinces); setAllCountries(countries); setWars(wars);
    setDiplomaticRelations(relations); setRecruitments(recruitments); setBuildingConstructions(buildingConstructions);
    setPlayerTechState(currentPlayerTechState); setBotTechStates(currentBotTechStates); setDate((prev: GameDate) => advanceDate(prev));

    armiesRef.current = armies; provincesRef.current = provinces; countriesRef.current = countries;
    warsRef.current = wars; diplomaticRelationsRef.current = relations; recruitmentsRef.current = recruitments;
    activeBattlesRef.current = currentActiveBattles; buildingConstructionsRef.current = buildingConstructions;
    playerTechStateRef.current = currentPlayerTechState; botTechStatesRef.current = currentBotTechStates;
  }, [addLog, playerCountryTag]);

  useEffect(() => {
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null; }
    if (gameSpeed > 0 && !isPaused) {
      gameLoopRef.current = window.setInterval(processTick, SPEED_INTERVALS[gameSpeed]);
    }
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [gameSpeed, processTick, isPaused]);
}
