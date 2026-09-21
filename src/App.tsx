/**
 * ============================================================
 * MÓDULO 4 - Componente Principal do Jogo (REFACTORADO)
 * ============================================================
 * Arquitetura de Estado Refatorada:
 * - Uso rigoroso de atualizações funcionais (setState(prev => ...))
 * - Processamento sequencial em variáveis locais
 * - Eliminação de stale closures no game loop
 * - Logs de debug em pontos críticos
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { GameMap } from './components/GameMap';
import { ProvincePanel } from './components/ProvincePanel';
import { DiplomacyPanel } from './components/DiplomacyPanel';
import { WarPanel } from './components/WarPanel';
import { BattleReportModal } from './components/BattleReportModal';
import { BattleHistoryModal } from './components/BattleHistoryModal';
import { TechnologyModal } from './components/TechnologyModal';
import { provincesData } from './data/provinces';
import { countries as initialCountries } from './data/countries';
import { processDailyTick } from './engine/economy';
import {
  processRecruitments,
  processArmyMovement,
  moveArmy,
  getEnemyArmiesInProvince,
  getFriendlyArmiesInProvince,
  mergeArmies,
  splitArmy,
  splitArmyHalf,
  generateRecruitmentId,
} from './engine/military';
import { resolveBattle, calculateArmySize, checkAllProvinceCombats } from './engine/combat';
import { getRecruitmentCost } from './data/units';
import { getBuildingCost, getBuildingTime } from './data/buildings';
import {
  processDailyTechProgress,
  startNationalFocus,
  startTechnologyResearch,
  calculateTechBonuses,
  createInitialTechState,
} from './engine/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from './data/technologies';
import {
  BuildingType,
  Country,
  Province,
  GameDate,
  Army,
  Recruitment,
  UnitType,
  CombatResult,
} from './types';
import { CountryTechState } from './types/technology';
import { DiplomaticRelation, War } from './types/diplomacy';
import {
  declareWar,
  makePeace,
  improveRelations,
  offerNonAggressionPact,
  getOrCreateRelation,
  areAtWar,
  processDiplomacyTick,
  updateWarScore,
  DIPLOMATIC_COSTS
} from './engine/diplomacy';
import { processAITick } from './engine/aiEngine';

/**
 * Velocidades do jogo em ms por tick (dia)
 */
const SPEED_INTERVALS: Record<number, number> = {
  0: 0,
  1: 1000,
  2: 500,
  3: 250,
  4: 125,
  5: 60,
};

/**
 * Exércitos iniciais para demonstração
 */
function createInitialArmies(): Army[] {
  return [
    {
      id: 'army_init_1',
      owner: 'IMP',
      name: '1º Exército Imperial',
      regiments: [
        { type: 'infantry', strength: 3000, morale: 90 },
        { type: 'infantry', strength: 2000, morale: 85 },
        { type: 'cavalry', strength: 1000, morale: 80 },
      ],
      location: 'p1',
      destination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
    },
    {
      id: 'army_init_2',
      owner: 'REP',
      name: 'Legião Valoriana',
      regiments: [
        { type: 'infantry', strength: 2500, morale: 88 },
        { type: 'cavalry', strength: 800, morale: 82 },
      ],
      location: 'p6',
      destination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
    },
    {
      id: 'army_init_3',
      owner: 'RNO',
      name: 'Guarda Nordiana',
      regiments: [
        { type: 'infantry', strength: 2000, morale: 92 },
        { type: 'artillery', strength: 500, morale: 85 },
      ],
      location: 'p10',
      destination: null,
      movementProgress: 0,
      movementSpeed: 0.5,
      position: null,
      path: [],
      targetArmyId: null,
    },
    {
      id: 'army_init_4',
      owner: 'KHA',
      name: 'Horda Dourada',
      regiments: [
        { type: 'cavalry', strength: 4000, morale: 95 },
        { type: 'cavalry', strength: 2000, morale: 90 },
      ],
      location: 'p14',
      destination: null,
      movementProgress: 0,
      movementSpeed: 1.5,
      position: null,
      path: [],
      targetArmyId: null,
    },
    {
      id: 'army_init_5',
      owner: 'THC',
      name: 'Guarda Sagrada',
      regiments: [
        { type: 'infantry', strength: 2000, morale: 95 },
        { type: 'artillery', strength: 1000, morale: 88 },
      ],
      location: 'p17',
      destination: null,
      movementProgress: 0,
      movementSpeed: 0.75,
      position: null,
      path: [],
      targetArmyId: null,
    },
    {
      id: 'army_init_6',
      owner: 'LIG',
      name: 'Mercenários de Portus',
      regiments: [
        { type: 'infantry', strength: 1500, morale: 75 },
        { type: 'cavalry', strength: 500, morale: 70 },
      ],
      location: 'p20',
      destination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
    },
  ];
}

/**
 * Componente raiz da aplicação
 */
const App: React.FC = () => {
  // === Estado do Jogo ===
  const [playerCountryTag] = useState<string>('IMP');
  const [date, setDate] = useState<GameDate>({ year: 1444, month: 11, day: 11 });
  const [gameSpeed, setGameSpeed] = useState<number>(0);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  /** Dados dinâmicos das províncias */
  const [provinces, setProvinces] = useState<Province[]>(() =>
    provincesData.map((p) => ({ ...p, buildings: [...p.buildings] }))
  );

  /** Dados dinâmicos dos países */
  const [allCountries, setAllCountries] = useState<Country[]>(() =>
    initialCountries.map((c) => ({
      ...c,
      resources: { ...c.resources },
      economy: { ...c.economy },
    }))
  );

  /** Exércitos no mapa */
  const [armies, setArmies] = useState<Army[]>(createInitialArmies);

  /** Recrutamentos em andamento */
  const [recruitments, setRecruitments] = useState<Recruitment[]>([]);

  /** Exército selecionado */
  const [selectedArmy, setSelectedArmy] = useState<string | null>(null);

  /** Log de eventos (combate, conquistas) */
  const [eventLog, setEventLog] = useState<string[]>([]);

  /** Relações diplomáticas */
  const [diplomaticRelations, setDiplomaticRelations] = useState<DiplomaticRelation[]>([]);

  /** Guerras ativas */
  const [wars, setWars] = useState<War[]>([]);

  /** País alvo do painel de diplomacia */
  const [diplomacyTarget, setDiplomacyTarget] = useState<string | null>(null);

  /** Painel de guerras aberto */
  const [showWarPanel, setShowWarPanel] = useState(false);

  /** Modal de relatório de batalha */
  const [battleReport, setBattleReport] = useState<CombatResult | null>(null);
  
  /** Jogo pausado (para relatório de batalha) */
  const [isPaused, setIsPaused] = useState(false);

  /** Histórico de batalhas */
  const [battleHistory, setBattleHistory] = useState<CombatResult[]>([]);

  /** Modal de histórico de batalhas aberto */
  const [showBattleHistory, setShowBattleHistory] = useState(false);

  /** Modal de tecnologias aberto */
  const [showTechModal, setShowTechModal] = useState(false);

  /** Estado de tecnologias do jogador */
  const [playerTechState, setPlayerTechState] = useState<CountryTechState>(() =>
    createInitialTechState(playerCountryTag)
  );

  /** Estados de tecnologias dos bots */
  const [botTechStates, setBotTechStates] = useState<Map<string, CountryTechState>>(() => {
    const map = new Map<string, CountryTechState>();
    initialCountries.forEach(country => {
      if (country.tag !== playerCountryTag) {
        map.set(country.tag, createInitialTechState(country.tag));
      }
    });
    return map;
  });

  /** Refs para game loop */
  const gameLoopRef = useRef<number | null>(null);
  const provincesRef = useRef(provinces);
  const countriesRef = useRef(allCountries);
  const armiesRef = useRef(armies);
  const recruitmentsRef = useRef(recruitments);
  const warsRef = useRef(wars);
  const diplomaticRelationsRef = useRef(diplomaticRelations);
  const dateRef = useRef(date);
  const playerTechStateRef = useRef(playerTechState);
  const botTechStatesRef = useRef(botTechStates);

  useEffect(() => { provincesRef.current = provinces; }, [provinces]);
  useEffect(() => { countriesRef.current = allCountries; }, [allCountries]);
  useEffect(() => { armiesRef.current = armies; }, [armies]);
  useEffect(() => { recruitmentsRef.current = recruitments; }, [recruitments]);
  useEffect(() => { warsRef.current = wars; }, [wars]);
  useEffect(() => { diplomaticRelationsRef.current = diplomaticRelations; }, [diplomaticRelations]);
  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => { playerTechStateRef.current = playerTechState; }, [playerTechState]);
  useEffect(() => { botTechStatesRef.current = botTechStates; }, [botTechStates]);

  // === Dados Derivados ===
  const playerCountry = useMemo(
    () => allCountries.find((c) => c.tag === playerCountryTag)!,
    [allCountries, playerCountryTag]
  );

  const selectedProvinceData = useMemo(
    () => provinces.find((p) => p.id === selectedProvince) ?? null,
    [provinces, selectedProvince]
  );

  const selectedArmyData = useMemo(
    () => armies.find((a) => a.id === selectedArmy) ?? null,
    [armies, selectedArmy]
  );

  /** Adiciona evento ao log */
  const addLog = useCallback((msg: string) => {
    setEventLog((prev) => [msg, ...prev].slice(0, 20));
  }, []);

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
    };

    console.log('🔄 [TICK START] Snapshot:', {
      armies: snapshot.armies.length,
      recruitments: snapshot.recruitments.length,
      provinces: snapshot.provinces.length,
    });

    // Trabalha com cópias mutáveis locais
    let armies = [...snapshot.armies];
    let provinces = [...snapshot.provinces];
    let countries = [...snapshot.countries];
    let wars = [...snapshot.wars];
    let relations = [...snapshot.relations];
    let recruitments = [...snapshot.recruitments];

    // ===== PASSO A: RECRUTAMENTO =====
    console.log('📋 [PASSO A] Processando recrutamentos, fila:', recruitments.length);
    const recruitResult = processRecruitments(recruitments, armies, countries);
    armies = recruitResult.armies;
    recruitments = recruitResult.recruitments;
    console.log('✅ [PASSO A] Recrutamentos processados, exércitos:', armies.length);

    // ===== PASSO B: MOVIMENTAÇÃO =====
    const moveResult = processArmyMovement(armies, provinces);
    armies = moveResult.armies;
    const arrivedArmies = moveResult.arrivedArmies;

    // ===== PASSO C: DETECÇÃO E RESOLUÇÃO DE BATALHA =====
    // C.1: Processa exércitos que chegaram ao destino
    for (const arrived of arrivedArmies) {
      const province = provinces.find(p => p.id === arrived.location);
      if (!province) {
        armies = [...armies, arrived];
        continue;
      }

      const isInWar = wars.some(
        w => (w.attacker === arrived.owner && w.defender === province.owner) ||
             (w.defender === arrived.owner && w.attacker === province.owner)
      );

      if (province.owner !== arrived.owner && !isInWar) {
        armies = [...armies, arrived];
        continue;
      }

      const enemies = getEnemyArmiesInProvince(armies, arrived.location!, arrived.owner);

      if (enemies.length > 0) {
        console.log('⚔️ [COMBAT TRIGGERED AT]:', province.id);
        const enemy = enemies[0];
        const result = resolveBattle(arrived, enemy, province, snapshot.date);

        armies = armies.filter(a => a.id !== arrived.id && a.id !== enemy.id);

        wars = wars.map(w => {
          if ((w.attacker === arrived.owner && w.defender === enemy.owner) ||
              (w.defender === arrived.owner && w.attacker === enemy.owner)) {
            const isAttacker = w.attacker === arrived.owner;
            return {
              ...w,
              attackerCasualties: w.attackerCasualties + (isAttacker ? result.attackerCasualties : result.defenderCasualties),
              defenderCasualties: w.defenderCasualties + (isAttacker ? result.defenderCasualties : result.attackerCasualties)
            };
          }
          return w;
        });

        if (result.winner === 'attacker') {
          if (result.attacker.regiments.length > 0) {
            armies = [...armies, { ...result.attacker, location: arrived.location }];
          }
          const oldOwner = province.owner;
          provinces = provinces.map(p =>
            p.id === province.id ? { ...p, owner: arrived.owner } : p
          );
          countries = countries.map(c => {
            if (c.tag === arrived.owner) return { ...c, provinces: [...c.provinces, province.id] };
            if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
            return c;
          });
          
          // Atualiza resultado com mudança territorial
          result.territoryChanged = true;
          result.newOwner = arrived.owner;
          
          addLog(`⚔️ ${arrived.owner} conquistou ${province.name} de ${oldOwner}!`);
          
          // Registra no histórico de batalhas
          setBattleHistory(prev => [result, ...prev]);
          
          // Se o jogador está envolvido, mostra relatório e pausa
          if (arrived.owner === playerCountryTag || enemy.owner === playerCountryTag) {
            setBattleReport(result);
            setIsPaused(true);
          }
        } else {
          if (result.defender.regiments.length > 0) {
            armies = [...armies, { ...result.defender, location: arrived.location }];
          }
          addLog(`🛡️ ${enemy.owner} defendeu ${province.name} contra ${arrived.owner}!`);
          
          // Registra no histórico de batalhas
          setBattleHistory(prev => [result, ...prev]);
          
          // Se o jogador está envolvido, mostra relatório e pausa
          if (arrived.owner === playerCountryTag || enemy.owner === playerCountryTag) {
            setBattleReport(result);
            setIsPaused(true);
          }
        }
      } else {
        armies = [...armies, arrived];
        if (province.owner !== arrived.owner && isInWar) {
          const oldOwner = province.owner;
          provinces = provinces.map(p =>
            p.id === province.id ? { ...p, owner: arrived.owner } : p
          );
          countries = countries.map(c => {
            if (c.tag === arrived.owner) return { ...c, provinces: [...c.provinces, province.id] };
            if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
            return c;
          });
          addLog(`🏳️ ${arrived.owner} ocupou ${province.name} (sem resistência)`);
        }
      }
    }

    // C.2: Verificação automática de combate em todas as províncias
    console.log('⚔️ [PASSO C] Verificando combates automáticos, exércitos:', armies.length);
    const autoCombatResult = checkAllProvinceCombats(armies, provinces, wars, snapshot.date);
    armies = autoCombatResult.armies;

    for (const battle of autoCombatResult.battles) {
      const province = provinces.find(p => p.id === battle.provinceId);
      if (!province) continue;

      wars = wars.map(w => {
        if ((w.attacker === battle.result.attacker.owner && w.defender === battle.result.defender.owner) ||
            (w.defender === battle.result.attacker.owner && w.attacker === battle.result.defender.owner)) {
          const isAttacker = w.attacker === battle.result.attacker.owner;
          return {
            ...w,
            attackerCasualties: w.attackerCasualties + (isAttacker ? battle.result.attackerCasualties : battle.result.defenderCasualties),
            defenderCasualties: w.defenderCasualties + (isAttacker ? battle.result.defenderCasualties : battle.result.attackerCasualties)
          };
        }
        return w;
      });

      if (battle.result.winner === 'attacker' && province.owner !== battle.result.attacker.owner) {
        const oldOwner = province.owner;
        provinces = provinces.map(p =>
          p.id === province.id ? { ...p, owner: battle.result.attacker.owner } : p
        );
        countries = countries.map(c => {
          if (c.tag === battle.result.attacker.owner) return { ...c, provinces: [...c.provinces, province.id] };
          if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
          return c;
        });
        
        // Atualiza resultado com mudança territorial
        battle.result.territoryChanged = true;
        battle.result.newOwner = battle.result.attacker.owner;
        
          addLog(`⚔️ ${battle.result.attacker.owner} conquistou ${province.name} de ${oldOwner}!`);
          
          // Registra no histórico de batalhas
          setBattleHistory(prev => [battle.result, ...prev]);
          
          // Se o jogador está envolvido, mostra relatório e pausa
          if (battle.result.attacker.owner === playerCountryTag || battle.result.defender.owner === playerCountryTag) {
            setBattleReport(battle.result);
            setIsPaused(true);
          }
        } else if (battle.result.winner === 'defender') {
          addLog(`🛡️ ${battle.result.defender.owner} defendeu ${province.name}!`);
          
          // Registra no histórico de batalhas
          setBattleHistory(prev => [battle.result, ...prev]);
          
          // Se o jogador está envolvido, mostra relatório e pausa
          if (battle.result.attacker.owner === playerCountryTag || battle.result.defender.owner === playerCountryTag) {
            setBattleReport(battle.result);
            setIsPaused(true);
          }
        }    }

    // ===== PASSO D: ECONOMIA/POPULAÇÃO =====
    countries = countries.map(country => {
      const countryProvinces = provinces.filter(p => p.owner === country.tag);
      const { country: updatedCountry, provinces: updatedProvs } =
        processDailyTick(country, countryProvinces);

      for (const updatedProv of updatedProvs) {
        const idx = provinces.findIndex(p => p.id === updatedProv.id);
        if (idx !== -1) {
          provinces = [...provinces];
          provinces[idx] = updatedProv;
        }
      }

      return updatedCountry;
    });

    // ===== PASSO E: DIPLOMACIA =====
    relations = processDiplomacyTick(relations);

    // ===== PASSO E.5: TECNOLOGIAS E FOCOS =====
    // Usa a ref para garantir que está usando o estado mais recente (não o estado do React que pode estar desatualizado)
    let currentPlayerTechState = playerTechStateRef.current;
    
    // Processa progresso de tecnologias do jogador
    const playerCountry = countries.find(c => c?.tag === playerCountryTag);
    if (currentPlayerTechState && playerCountry) {
      const playerTechResult = processDailyTechProgress(currentPlayerTechState, playerCountry);
      currentPlayerTechState = playerTechResult.techState;
      
      // Atualiza a ref imediatamente com o novo estado
      playerTechStateRef.current = currentPlayerTechState;
      
      if (playerTechResult.notifications?.length > 0) {
        playerTechResult.notifications.forEach(notif => addLog(notif));
      }
    }

    // Processa progresso de tecnologias dos bots
    let currentBotTechStates = new Map(botTechStatesRef.current);
    countries.forEach(country => {
      if (country?.tag && country.tag !== playerCountryTag) {
        const botTechState = currentBotTechStates.get(country.tag);
        if (botTechState) {
          const botTechResult = processDailyTechProgress(botTechState, country);
          currentBotTechStates.set(country.tag, botTechResult.techState);
          if (botTechResult.notifications?.length > 0) {
            botTechResult.notifications.forEach(notif => addLog(`🤖 ${country.name}: ${notif}`));
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
    const currentDate = dateRef.current;
    
    // Filtra exércitos inválidos/nulos antes de passar para o motor da IA
    const validArmies = armies.filter(a => a && a.id && a.location && a.owner);
    
    countries = countries.map(country => {
      if (country.tag === playerCountryTag) return country;

      const aiResult = processAITick(
        country, provinces, validArmies, relations, wars, countries, currentDate
      );

      armies = aiResult.armies;
      relations = aiResult.relations;
      wars = aiResult.wars;
      provinces = aiResult.provinces;

      if (aiResult.log) addLog(aiResult.log);

      return aiResult.country;
    });

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

    // ===== APLICA TODAS AS ATUALIZAÇÕES DE UMA VEZ =====
    console.log('✅ [TICK END] Estado final:', {
      armies: armies.length,
      recruitments: recruitments.length,
    });

    setArmies(armies);
    setProvinces(provinces);
    setAllCountries(countries);
    setWars(wars);
    setDiplomaticRelations(relations);
    setRecruitments(recruitments);
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

  // === Handlers de Diplomacia ===

  /**
   * Abre painel de diplomacia com um país
   */
  const handleOpenDiplomacy = useCallback((countryTag: string) => {
    setDiplomacyTarget(countryTag);
  }, []);

  /**
   * Fecha painel de diplomacia
   */
  const handleCloseDiplomacy = useCallback(() => {
    setDiplomacyTarget(null);
  }, []);

  // === Handlers ===
  const handleProvinceClick = useCallback((provinceId: string) => {
    const province = provinces.find(p => p.id === provinceId);
    if (province && province.owner !== playerCountryTag) {
      // Província estrangeira - abre diplomacia
      handleOpenDiplomacy(province.owner);
    } else {
      setSelectedProvince(provinceId);
      setIsPanelOpen(true);
      setSelectedArmy(null);
    }
  }, [provinces, playerCountryTag, handleOpenDiplomacy]);

  const handleProvinceHover = useCallback((provinceId: string | null) => {
    setHoveredProvince(provinceId);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedProvince(null);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setGameSpeed(speed);
  }, []);

  /**
   * Constrói um edifício em uma província
   */
  const handleBuild = useCallback(
    (provinceId: string, buildingType: BuildingType) => {
      const province = provinces.find((p) => p.id === provinceId);
      if (!province || province.owner !== playerCountryTag) return;
      if (province.buildings.some((b) => b.daysRemaining > 0)) return;

      const existingBuilding = province.buildings.find((b) => b.type === buildingType);
      const currentLevel = existingBuilding?.level ?? 0;

      const cost = getBuildingCost(buildingType, currentLevel);
      const buildTime = getBuildingTime(buildingType, currentLevel);

      if (playerCountry.resources.gold < cost) return;

      setAllCountries((prev) =>
        prev.map((c) =>
          c.tag === playerCountryTag
            ? { ...c, resources: { ...c.resources, gold: c.resources.gold - cost } }
            : c
        )
      );

      setProvinces((prev) =>
        prev.map((p) => {
          if (p.id !== provinceId) return p;
          const newBuildings = [...p.buildings];
          const existingIdx = newBuildings.findIndex((b) => b.type === buildingType);
          if (existingIdx >= 0) {
            newBuildings[existingIdx] = {
              ...newBuildings[existingIdx],
              level: newBuildings[existingIdx].level + 1,
              daysRemaining: buildTime,
            };
          } else {
            newBuildings.push({ type: buildingType, level: 1, daysRemaining: buildTime });
          }
          return { ...p, buildings: newBuildings };
        })
      );
    },
    [provinces, playerCountryTag, playerCountry.resources.gold]
  );

  /**
   * Recruta uma unidade em uma província
   */
  const handleRecruit = useCallback(
    (provinceId: string, unitType: UnitType) => {
      console.log('🎯 handleRecruit chamado:', { provinceId, unitType });
      
      const province = provinces.find((p) => p.id === provinceId);
      if (!province || province.owner !== playerCountryTag) {
        console.log('❌ Província inválida ou não pertence ao jogador');
        return;
      }

      const costs = getRecruitmentCost(unitType);
      console.log('💰 Custos:', costs);
      console.log('💰 Recursos atuais:', { gold: playerCountry.resources.gold, manpower: playerCountry.resources.manpower });

      // Verifica recursos
      if (playerCountry.resources.gold < costs.gold) {
        console.log('❌ Ouro insuficiente');
        addLog(`❌ Ouro insuficiente para recrutar ${unitType}`);
        return;
      }
      if (playerCountry.resources.manpower < costs.manpower) {
        console.log('❌ Manpower insuficiente');
        addLog(`❌ Manpower insuficiente para recrutar ${unitType}`);
        return;
      }

      // Deduz recursos
      setAllCountries((prev) =>
        prev.map((c) =>
          c.tag === playerCountryTag
            ? {
                ...c,
                resources: {
                  ...c.resources,
                  gold: c.resources.gold - costs.gold,
                  manpower: c.resources.manpower - costs.manpower,
                },
              }
            : c
        )
      );

      // Adiciona recrutamento
      const newRecruitment: Recruitment = {
        id: generateRecruitmentId(),
        provinceId,
        owner: playerCountryTag,
        unitType,
        daysRemaining: costs.days,
      };
      console.log('✅ Adicionando recrutamento à fila:', newRecruitment);
      setRecruitments((prev) => {
        const updated = [...prev, newRecruitment];
        console.log('📋 Fila de recrutamentos atualizada:', updated);
        return updated;
      });
      addLog(`🗡️ Recrutando ${unitType} em ${province.name} (${costs.days} dias)`);
    },
    [provinces, playerCountryTag, playerCountry, addLog]
  );

  /**
   * Seleciona um exército
   */
  const handleArmyClick = useCallback((armyId: string) => {
    const army = armiesRef.current.find(a => a.id === armyId);
    if (army && army.owner === playerCountryTag) {
      setSelectedArmy(armyId);
      setSelectedProvince(null);
      setIsPanelOpen(false);
    }
  }, [playerCountryTag]);

  /**
   * Move o exército selecionado para uma província (right-click)
   */
  const handleProvinceRightClick = useCallback(
    (provinceId: string) => {
      if (!selectedArmy) return;

      const army = armiesRef.current.find((a) => a.id === selectedArmy);
      if (!army || army.owner !== playerCountryTag) return;
      if (army.destination) return; // Já está se movendo

      const moved = moveArmy(army, provinceId, provincesRef.current, wars);
      if (moved) {
        setArmies((prev) => prev.map((a) => (a.id === army.id ? moved : a)));
        const destProvince = provincesRef.current.find(p => p.id === provinceId);
        addLog(`🚶 ${army.name} marchando para ${destProvince?.name ?? provinceId}`);
      }
    },
    [selectedArmy, playerCountryTag, addLog, wars]
  );

  /**
   * Funde dois exércitos em um só
   */
  const handleMergeArmies = useCallback(
    (targetArmyId: string) => {
      if (!selectedArmy) return;

      const army1 = armiesRef.current.find((a) => a.id === selectedArmy);
      const army2 = armiesRef.current.find((a) => a.id === targetArmyId);

      if (!army1 || !army2) return;
      if (army1.owner !== playerCountryTag || army2.owner !== playerCountryTag) return;
      if (army1.location !== army2.location) return;
      if (army1.destination || army2.destination) return;

      const merged = mergeArmies(army1, army2);

      setArmies((prev) => {
        // Remove ambos e adiciona o fundido
        const filtered = prev.filter((a) => a.id !== army1.id && a.id !== army2.id);
        return [...filtered, merged];
      });

      addLog(`🤝 ${army1.name} + ${army2.name} fundidos (${calculateArmySize(merged).toLocaleString()} homens)`);
    },
    [selectedArmy, playerCountryTag, addLog]
  );

  /** Estado do modal de divisão */
  const [showSplitModal, setShowSplitModal] = useState(false);
  /** Índices de regimentos selecionados para transferência */
  const [splitSelection, setSplitSelection] = useState<Set<number>>(new Set());

  /**
   * Divide o exército selecionado ao meio
   */
  const handleSplitHalf = useCallback(() => {
    if (!selectedArmy) return;
    const army = armiesRef.current.find((a) => a.id === selectedArmy);
    if (!army || army.owner !== playerCountryTag) return;
    if (army.destination) return;

    const newArmy = splitArmyHalf(army, `${army.name} (Destacamento)`);
    if (!newArmy) return;

    // Remove regimentos transferidos do exército original
    const halfIndex = Math.floor(army.regiments.length / 2);
    const remainingRegiments = army.regiments.slice(halfIndex);

    setArmies((prev) => {
      const filtered = prev.filter((a) => a.id !== army.id);
      return [
        ...filtered,
        { ...army, regiments: remainingRegiments },
        newArmy,
      ];
    });

    addLog(`✂️ ${army.name} dividido. Novo exército: ${newArmy.name} (${calculateArmySize(newArmy).toLocaleString()} homens)`);
  }, [selectedArmy, playerCountryTag, addLog]);

  /**
   * Divide o exército com seleção customizada de regimentos
   */
  const handleSplitCustom = useCallback(() => {
    if (!selectedArmy || splitSelection.size === 0) return;
    const army = armiesRef.current.find((a) => a.id === selectedArmy);
    if (!army || army.owner !== playerCountryTag) return;
    if (army.destination) return;

    const indices = Array.from(splitSelection);
    const newArmy = splitArmy(army, indices, `${army.name} (Destacamento)`);
    if (!newArmy) return;

    // Remove regimentos transferidos do exército original
    const remainingRegiments = army.regiments.filter((_, idx) => !splitSelection.has(idx));

    setArmies((prev) => {
      const filtered = prev.filter((a) => a.id !== army.id);
      return [
        ...filtered,
        { ...army, regiments: remainingRegiments },
        newArmy,
      ];
    });

    setShowSplitModal(false);
    setSplitSelection(new Set());
    addLog(`✂️ ${army.name} dividido. Novo exército: ${newArmy.name} (${calculateArmySize(newArmy).toLocaleString()} homens)`);
  }, [selectedArmy, splitSelection, playerCountryTag, addLog]);

  /**
   * Toggle seleção de regimento no modal
   */
  const toggleSplitRegiment = useCallback((index: number) => {
    setSplitSelection((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  /**
   * Melhora relações com país alvo
   */
  const handleImproveRelations = useCallback(() => {
    if (!diplomacyTarget) return;
    if (playerCountry.resources.gold < DIPLOMATIC_COSTS.improve_relations.gold) return;

    setAllCountries(prev => prev.map(c => 
      c.tag === playerCountryTag 
        ? { ...c, resources: { ...c.resources, gold: c.resources.gold - DIPLOMATIC_COSTS.improve_relations.gold } }
        : c
    ));

    setDiplomaticRelations(prev => 
      improveRelations(prev, playerCountryTag, diplomacyTarget, DIPLOMATIC_COSTS.improve_relations.opinionChange)
    );

    addLog(`💰 Melhorou relações com ${allCountries.find(c => c.tag === diplomacyTarget)?.name}`);
  }, [diplomacyTarget, playerCountry.resources.gold, playerCountryTag, allCountries, addLog]);

  /**
   * Oferece pacto de não agressão
   */
  const handleOfferNonAggression = useCallback(() => {
    if (!diplomacyTarget) return;
    if (playerCountry.resources.gold < DIPLOMATIC_COSTS.offer_non_aggression.gold) return;

    setAllCountries(prev => prev.map(c => 
      c.tag === playerCountryTag 
        ? { ...c, resources: { ...c.resources, gold: c.resources.gold - DIPLOMATIC_COSTS.offer_non_aggression.gold } }
        : c
    ));

    setDiplomaticRelations(prev => 
      offerNonAggressionPact(prev, playerCountryTag, diplomacyTarget, 365)
    );

    addLog(`🤝 Pacto de não agressão com ${allCountries.find(c => c.tag === diplomacyTarget)?.name}`);
  }, [diplomacyTarget, playerCountry.resources.gold, playerCountryTag, allCountries, addLog]);

  /**
   * Declara guerra contra país alvo
   */
  const handleDeclareWar = useCallback(() => {
    if (!diplomacyTarget) return;

    const result = declareWar(diplomaticRelations, wars, playerCountryTag, diplomacyTarget, date);
    setDiplomaticRelations(result.relations);
    setWars(result.wars);

    addLog(`⚔️ Guerra declarada contra ${allCountries.find(c => c.tag === diplomacyTarget)?.name}!`);
    setDiplomacyTarget(null);
  }, [diplomacyTarget, diplomaticRelations, wars, playerCountryTag, date, allCountries, addLog]);

  /**
   * Assina paz em uma guerra
   */
  const handleMakePeace = useCallback((warId: string) => {
    const war = wars.find(w => w.id === warId);
    if (!war) return;

    const enemy = war.attacker === playerCountryTag ? war.defender : war.attacker;
    const result = makePeace(diplomaticRelations, wars, playerCountryTag, enemy);
    setDiplomaticRelations(result.relations);
    setWars(result.wars);

    addLog(`🕊️ Paz assinada com ${allCountries.find(c => c.tag === enemy)?.name}`);
  }, [wars, diplomaticRelations, playerCountryTag, allCountries, addLog]);

  const handleStartFocus = useCallback((focusId: string) => {
    // Validação de segurança
    if (!focusId || !playerTechState) {
      console.warn('handleStartFocus: focusId ou playerTechState inválido');
      return;
    }

    const updatedTechState = startNationalFocus(playerTechState, focusId);
    if (updatedTechState) {
      // Atualiza AMBOS: estado React E a ref imediatamente
      setPlayerTechState(updatedTechState);
      playerTechStateRef.current = updatedTechState;
      
      const focus = NATIONAL_FOCUSES?.find(f => f?.id === focusId);
      if (focus) {
        addLog(`🎯 Foco iniciado: ${focus.title}`);
      }
    }
  }, [playerTechState, addLog]);

  const handleStartResearch = useCallback((techId: string) => {
    // Validação de segurança
    if (!techId || !playerTechState || !playerCountry) {
      console.warn('handleStartResearch: techId, playerTechState ou playerCountry inválido');
      return;
    }

    const tech = TECHNOLOGIES?.find(t => t?.id === techId);
    if (!tech) {
      console.warn(`handleStartResearch: Tecnologia ${techId} não encontrada`);
      return;
    }

    // Validação de ouro suficiente
    if (playerCountry.resources.gold < tech.costGold) {
      addLog(`❌ Ouro insuficiente para pesquisar ${tech.title} (necessário: 💰 ${tech.costGold})`);
      return;
    }

    const { techState: updatedTechState, cost } = startTechnologyResearch(
      playerTechState,
      techId,
      playerCountry
    );
    
    if (updatedTechState) {
      // Deduz o custo da pesquisa
      setAllCountries(prev => prev.map(c => 
        c?.tag === playerCountryTag
          ? { ...c, resources: { ...c.resources, gold: c.resources.gold - cost } }
          : c
      ));
      
      // Atualiza AMBOS: estado React E a ref imediatamente
      setPlayerTechState(updatedTechState);
      playerTechStateRef.current = updatedTechState;
      
      addLog(`🔬 Pesquisa iniciada: ${tech.title} (💰 ${cost})`);
    }
  }, [playerTechState, playerCountry, playerCountryTag, addLog]);

  // === Renderização ===
  return (
    <div className="game">
      {/* === Barra Superior === */}
      <TopBar
        playerCountry={playerCountry}
        date={date}
        gameSpeed={gameSpeed}
        onSpeedChange={handleSpeedChange}
        onTechClick={() => setShowTechModal(true)}
      />

      {/* === Área Principal === */}
      <div className="game__main">
        {/* === Mapa === */}
        <GameMap
          provinces={provinces}
          countries={allCountries}
          armies={armies}
          selectedProvince={selectedProvince}
          hoveredProvince={hoveredProvince}
          selectedArmy={selectedArmy}
          onProvinceHover={handleProvinceHover}
          onProvinceClick={handleProvinceClick}
          onArmyClick={handleArmyClick}
          onProvinceRightClick={handleProvinceRightClick}
        />

        {/* === Painel Lateral === */}
        {isPanelOpen && selectedProvinceData && (
          <ProvincePanel
            province={selectedProvinceData}
            countries={allCountries}
            playerCountry={playerCountry}
            armies={armies}
            recruitments={recruitments}
            onClose={handleClosePanel}
            onProvinceClick={handleProvinceClick}
            onBuild={handleBuild}
            onRecruit={handleRecruit}
          />
        )}

        {/* === Info do Exército Selecionado === */}
        {selectedArmyData && (
          <div className="army-info-panel">
            <div className="army-info-panel__header">
              <h3>{selectedArmyData.name}</h3>
              <button onClick={() => setSelectedArmy(null)}>✕</button>
            </div>
            <div className="army-info-panel__content">
              <div className="army-info-panel__stat">
                <span>Total:</span>
                <span>{calculateArmySize(selectedArmyData).toLocaleString()} homens</span>
              </div>
              <div className="army-info-panel__stat">
                <span>Localização:</span>
                <span>
                  {selectedArmyData.location
                    ? provinces.find(p => p.id === selectedArmyData.location)?.name ?? '?'
                    : 'Em movimento'}
                </span>
              </div>
              {selectedArmyData.destination && (
                <>
                  <div className="army-info-panel__stat">
                    <span>Próximo:</span>
                    <span>
                      {provinces.find(p => p.id === selectedArmyData.destination)?.name ?? '?'}
                      {' '}({Math.round(selectedArmyData.movementProgress * 100)}%)
                    </span>
                  </div>
                  {selectedArmyData.path.length > 0 && (
                    <div className="army-info-panel__stat">
                      <span>Rota:</span>
                      <span className="army-info-panel__path">
                        {selectedArmyData.path
                          .map(pid => provinces.find(p => p.id === pid)?.name ?? '?')
                          .join(' → ')}
                      </span>
                    </div>
                  )}
                  {selectedArmyData.path.length > 0 && (
                    <div className="army-info-panel__stat">
                      <span>Destino Final:</span>
                      <span>
                        {provinces.find(p => p.id === selectedArmyData.path[selectedArmyData.path.length - 1])?.name ?? '?'}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="army-info-panel__regiments">
                <strong>Regimentos:</strong>
                {selectedArmyData.regiments.map((reg, i) => (
                  <div key={i} className="army-info-panel__regiment">
                    <span>{reg.type === 'infantry' ? '🗡️' : reg.type === 'cavalry' ? '🐎' : '💣'}</span>
                    <span>{Math.floor(reg.strength)}</span>
                    <span className="army-info-panel__morale">
                      ❤️ {Math.round(reg.morale)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* === Ações: Dividir Exército === */}
              {selectedArmyData.location && !selectedArmyData.destination && selectedArmyData.regiments.length >= 2 && (
                <div className="army-info-panel__actions-section">
                  <strong>✂️ Dividir Exército:</strong>
                  <div className="army-info-panel__actions-row">
                    <button
                      className="army-info-panel__action-btn"
                      onClick={handleSplitHalf}
                      title="Dividir ao meio (50% / 50%)"
                    >
                      ⚖️ Meio a Meio
                    </button>
                    <button
                      className="army-info-panel__action-btn"
                      onClick={() => {
                        setSplitSelection(new Set());
                        setShowSplitModal(true);
                      }}
                      title="Selecionar regimentos para dividir"
                    >
                      📋 Customizado
                    </button>
                  </div>
                </div>
              )}

              {/* === Outros exércitos na mesma província (para fusão) === */}
              {selectedArmyData.location && !selectedArmyData.destination && (() => {
                const friendlyArmies = getFriendlyArmiesInProvince(
                  armies,
                  selectedArmyData.location!,
                  playerCountryTag
                ).filter(a => a.id !== selectedArmyData.id);

                if (friendlyArmies.length === 0) return null;

                return (
                  <div className="army-info-panel__merge-section">
                    <strong>🤝 Fundir com:</strong>
                    {friendlyArmies.map(otherArmy => (
                      <button
                        key={otherArmy.id}
                        className="army-info-panel__merge-btn"
                        onClick={() => handleMergeArmies(otherArmy.id)}
                        title={`Fundir com ${otherArmy.name} (${calculateArmySize(otherArmy).toLocaleString()} homens)`}
                      >
                        <span className="army-info-panel__merge-flag">
                          {allCountries.find(c => c.tag === otherArmy.owner)?.flag}
                        </span>
                        <span className="army-info-panel__merge-name">
                          {otherArmy.name}
                        </span>
                        <span className="army-info-panel__merge-size">
                          {calculateArmySize(otherArmy).toLocaleString()} 👥
                        </span>
                        <span className="army-info-panel__merge-icon">⊕</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* === Modal de Divisão Customizada === */}
        {showSplitModal && selectedArmyData && (
          <div className="split-modal-overlay" onClick={() => setShowSplitModal(false)}>
            <div className="split-modal" onClick={(e) => e.stopPropagation()}>
              <div className="split-modal__header">
                <h3>✂️ Dividir: {selectedArmyData.name}</h3>
                <button onClick={() => setShowSplitModal(false)}>✕</button>
              </div>
              <div className="split-modal__content">
                <p className="split-modal__instruction">
                  Selecione os regimentos que serão transferidos para o novo exército:
                </p>
                <div className="split-modal__regiments">
                  {selectedArmyData.regiments.map((reg, i) => (
                    <button
                      key={i}
                      className={`split-modal__regiment-btn ${
                        splitSelection.has(i) ? 'split-modal__regiment-btn--selected' : ''
                      }`}
                      onClick={() => toggleSplitRegiment(i)}
                    >
                      <span className="split-modal__regiment-icon">
                        {reg.type === 'infantry' ? '🗡️' : reg.type === 'cavalry' ? '🐎' : '💣'}
                      </span>
                      <span className="split-modal__regiment-info">
                        <span className="split-modal__regiment-type">
                          {reg.type === 'infantry' ? 'Infantaria' : reg.type === 'cavalry' ? 'Cavalaria' : 'Artilharia'}
                        </span>
                        <span className="split-modal__regiment-strength">
                          {Math.floor(reg.strength)} homens
                        </span>
                      </span>
                      <span className="split-modal__regiment-check">
                        {splitSelection.has(i) ? '✓' : ''}
                      </span>
                    </button>
                  ))}
                </div>
                {splitSelection.size > 0 && (
                  <div className="split-modal__summary">
                    <span>Transferindo: {splitSelection.size} regimento(s)</span>
                    <span>
                      ({Array.from(splitSelection)
                        .map(i => Math.floor(selectedArmyData.regiments[i].strength))
                        .reduce((a, b) => a + b, 0)
                        .toLocaleString()} homens)
                    </span>
                  </div>
                )}
              </div>
              <div className="split-modal__footer">
                <button
                  className="split-modal__cancel-btn"
                  onClick={() => setShowSplitModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="split-modal__confirm-btn"
                  disabled={splitSelection.size === 0 || splitSelection.size >= selectedArmyData.regiments.length}
                  onClick={handleSplitCustom}
                >
                  ✂️ Dividir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === Painel de Diplomacia === */}
        {diplomacyTarget && (
          <DiplomacyPanel
            targetCountry={allCountries.find(c => c.tag === diplomacyTarget)!}
            playerCountry={playerCountry}
            relation={diplomaticRelations.find(
              r => (r.countryA === playerCountryTag && r.countryB === diplomacyTarget) ||
                   (r.countryB === playerCountryTag && r.countryA === diplomacyTarget)
            ) || null}
            onClose={handleCloseDiplomacy}
            onImproveRelations={handleImproveRelations}
            onOfferNonAggression={handleOfferNonAggression}
            onDeclareWar={handleDeclareWar}
          />
        )}

        {/* === Painel de Guerras === */}
        {showWarPanel && (
          <WarPanel
            wars={wars}
            playerCountry={playerCountry}
            allCountries={allCountries}
            onClose={() => setShowWarPanel(false)}
            onMakePeace={handleMakePeace}
          />
        )}

        {/* === Modal de Relatório de Batalha === */}
        {battleReport && (
          <BattleReportModal
            battleResult={battleReport}
            playerCountry={playerCountry}
            allCountries={allCountries}
            onClose={() => {
              setBattleReport(null);
              setIsPaused(false);
            }}
          />
        )}

        {/* === Modal de Histórico de Batalhas === */}
        {showBattleHistory && (
          <BattleHistoryModal
            battleHistory={battleHistory}
            allCountries={allCountries}
            onClose={() => setShowBattleHistory(false)}
            onViewBattle={(battle) => {
              setShowBattleHistory(false);
              setBattleReport(battle);
              setIsPaused(true);
            }}
          />
        )}

        {/* === Modal de Tecnologias === */}
        {showTechModal && (
          <TechnologyModal
            playerCountry={playerCountry}
            techState={playerTechState}
            onStartFocus={handleStartFocus}
            onStartResearch={handleStartResearch}
            onClose={() => setShowTechModal(false)}
          />
        )}
      </div>

      {/* === Barra Inferior === */}
      <div className="game__bottom-bar">
        <div className="game__bottom-info">
          <span className="game__bottom-label">Províncias:</span>
          <span className="game__bottom-value">{playerCountry.provinces.length}</span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Exércitos:</span>
          <span className="game__bottom-value">
            {armies.filter(a => a.owner === playerCountryTag).length}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Tropas:</span>
          <span className="game__bottom-value">
            {armies
              .filter(a => a.owner === playerCountryTag)
              .reduce((sum, a) => sum + calculateArmySize(a), 0)
              .toLocaleString()}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Histórico:</span>
          <button
            className="game__bottom-history-btn"
            onClick={() => setShowBattleHistory(true)}
            title="Ver histórico de batalhas"
          >
            📜 {battleHistory.length}
          </button>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Guerras:</span>
          <button
            className="game__bottom-war-btn"
            onClick={() => setShowWarPanel(true)}
            title="Ver guerras ativas"
          >
            {wars.filter(w => w.attacker === playerCountryTag || w.defender === playerCountryTag).length > 0
              ? `⚔️ ${wars.filter(w => w.attacker === playerCountryTag || w.defender === playerCountryTag).length}`
              : '🕊️ Paz'}
          </button>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Velocidade:</span>
          <span className="game__bottom-value game__bottom-value--highlight">
            {gameSpeed === 0 ? '⏸ Pausado' : `▶ x${gameSpeed}`}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Módulo:</span>
          <span className="game__bottom-value game__bottom-value--highlight">4 - Diplomacia</span>
        </div>
      </div>
    </div>
  );
};

export default App;
