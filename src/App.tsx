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
import { EndGameModal } from './components/EndGameModal';
import { SettingsModal } from './components/SettingsModal';
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
  cancelRecruitment,
  stopArmyMovement,
} from './engine/military';
import { LAWS } from './constants/laws';
import { resolveBattle, calculateArmySize, checkAllProvinceCombats, findRetreatProvince, applySiegeAnnihilation, startContinuousBattle, processDailyBattle, finalizeBattle, retreatArmyManually } from './engine/combat';
import { getRecruitmentCost } from './data/units';
import { getBuildingCost, getBuildingTime } from './data/buildings';
import { applyStabilityPrestigeChanges } from './engine/stability';
import { processDailyUnrestDecay, createRebelArmy, applyConquestUnrest } from './engine/unrest';
import { processRebelAccumulation, processSeparatistAI, checkRebelTerritoryReturn, ensureSeparatistWars } from './engine/rebellions';
import {
  processDailyTechProgress,
  startNationalFocus,
  startTechnologyResearch,
  calculateTechBonuses,
  createInitialTechState,
} from './engine/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from './data/technologies';
import { checkEndGameConditions, calculateGameStats, EndGameType, GameStats } from './engine/gameConditions';
import {
  BuildingType,
  Country,
  Province,
  GameDate,
  Army,
  Recruitment,
  UnitType,
  CombatResult,
  BuildingConstruction,
  ActiveBattle,
} from './types';
import { CountryTechState } from './types/technology';
import { DiplomaticRelation, War } from './types/diplomacy';
import { AIDifficulty, DIFFICULTY_SPEED_MULTIPLIERS, DIFFICULTY_DESCRIPTIONS, DIFFICULTY_ICONS } from './types/difficulty';
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
import { processAI, processAIEconomicDecisions } from './engine/aiEngine';
import { queueBuilding, processConstructions, cancelBuilding, isActiveConstruction } from './engine/buildings';
import { ToastProvider, useToast } from './context/ToastContext';
import { AILogProvider, useAILog } from './context/AILogContext';
import { ToastContainer } from './components/ToastContainer';
import { NotificationLogModal } from './components/NotificationLogModal';
import { AILogModal } from './components/AILogModal';
import { GovernmentModal } from './components/GovernmentModal';
import { getBuildingName, getUnitName } from './utils/translations';
import { LawCategory } from './types/government';

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
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
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
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
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
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 0.5,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
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
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 1.5,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
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
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 0.75,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
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
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
    },
  ];
}

/**
 * Componente raiz da aplicação
 */
const App: React.FC = () => {
  // === Hook de Toasts ===
  const { addToast, notificationHistory, unreadCount, markAllAsRead } = useToast();

  // === Hook de Log da IA ===
  const { addAILog } = useAILog();

  // === Estado do Jogo ===
  const [playerCountryTag] = useState<string>('IMP');
  const [date, setDate] = useState<GameDate>({ year: 1444, month: 11, day: 11 });
  const [gameSpeed, setGameSpeed] = useState<number>(0);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  /** Dificuldade da IA */
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');

  /** Dados dinâmicos das províncias */
  const [provinces, setProvinces] = useState<Province[]>(() =>
    provincesData.map((p) => ({
      ...p,
      buildings: [...p.buildings],
      unrest: 0, // Inicialmente todas as províncias estão pacíficas
      originalOwner: p.owner, // ✅ Define originalOwner para todas as províncias
    }))
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

  /** Fila de construções */
  const [buildingConstructions, setBuildingConstructions] = useState<BuildingConstruction[]>([]);

  /** Exército selecionado */  const [selectedArmy, setSelectedArmy] = useState<string | null>(null);

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

  /** Modal de histórico de notificações aberto */
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  /** Modal de log da IA aberto */
  const [showAILogModal, setShowAILogModal] = useState(false);

  /** Modal de governo aberto */
  const [showGovernmentModal, setShowGovernmentModal] = useState(false);

  /** Modal de configurações aberto */  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  /** Sistema de fim de jogo */
  const [endGameType, setEndGameType] = useState<EndGameType>(null);
  const [hasTriggeredEndGame, setHasTriggeredEndGame] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);

  /** Batalhas ativas em andamento */
  const [activeBattles, setActiveBattles] = useState<ActiveBattle[]>([]);

  /** Refs para game loop */
  const gameLoopRef = useRef<number | null>(null);
  const provincesRef = useRef(provinces);
  const countriesRef = useRef(allCountries);
  const armiesRef = useRef(armies);
  const recruitmentsRef = useRef(recruitments);
  const warsRef = useRef(wars);
  const diplomaticRelationsRef = useRef(diplomaticRelations);
  const dateRef = useRef(date);
  const buildingConstructionsRef = useRef(buildingConstructions);
  const playerTechStateRef = useRef(playerTechState);
  const botTechStatesRef = useRef(botTechStates);
  const aiDifficultyRef = useRef(aiDifficulty);
  const activeBattlesRef = useRef(activeBattles);

  useEffect(() => { provincesRef.current = provinces; }, [provinces]);
  useEffect(() => { countriesRef.current = allCountries; }, [allCountries]);
  useEffect(() => { armiesRef.current = armies; }, [armies]);
  useEffect(() => { recruitmentsRef.current = recruitments; }, [recruitments]);
  useEffect(() => { warsRef.current = wars; }, [wars]);
  useEffect(() => { diplomaticRelationsRef.current = diplomaticRelations; }, [diplomaticRelations]);
  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => { playerTechStateRef.current = playerTechState; }, [playerTechState]);
  useEffect(() => { botTechStatesRef.current = botTechStates; }, [botTechStates]);
  useEffect(() => { buildingConstructionsRef.current = buildingConstructions; }, [buildingConstructions]);
  useEffect(() => { aiDifficultyRef.current = aiDifficulty; }, [aiDifficulty]);
  useEffect(() => { activeBattlesRef.current = activeBattles; }, [activeBattles]);

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

  /** Formata a data do jogo para exibição em notificações */
  const formatGameDate = useCallback((date: GameDate): string => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${date.day} de ${months[date.month - 1]}, ${date.year}`;
  }, []);

  /**
   * Cancela recrutamentos e construções quando uma província muda de dono
   */
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

    // ===== PASSO A: RECRUTAMENTO =====
    const recruitResult = processRecruitments(recruitments, armies, countries, provinces);
    armies = recruitResult.armies;
    recruitments = recruitResult.recruitments;

    // Processa recrutamentos concluídos
    for (const completed of recruitResult.completedRecruitments) {
      const unitName = getUnitName(completed.unitType);
      const province = provinces.find(p => p.id === completed.provinceId);
      const provinceName = province?.name || 'província';
      const dateString = formatGameDate(snapshot.date);

      // Mostra toast de conclusão APENAS para o jogador
      if (completed.owner === playerCountryTag) {
        if (completed.count > 1) {
          addToast(
            `Treinamento de ${completed.count}x ${unitName} concluído em ${provinceName}!`,
            'success',
            'Tropas Recrutadas',
            dateString
          );
        } else {
          addToast(
            `Treinamento de ${unitName} concluído em ${provinceName}!`,
            'success',
            'Tropa Recrutada',
            dateString
          );
        }
      }

      // Registra no log da IA se o recrutamento foi de um bot
      if (completed.owner !== playerCountryTag) {
        const country = countries.find(c => c.tag === completed.owner);
        if (country && province) {
          addAILog(
            country.name,
            'military',
            `Recrutamento de ${unitName} concluído em ${provinceName}`,
            dateString,
            country.color
          );
        }
      }
    }

    // ===== PASSO A.5: CONSTRUÇÕES =====
    const constructionResult = processConstructions(buildingConstructions, provinces);
    buildingConstructions = constructionResult.updatedConstructions;

    // Processa construções concluídas
    for (const completed of constructionResult.completedConstructions) {
      const province = provinces.find(p => p.id === completed.provinceId);
      if (province) {
        // Adiciona o edifício à província
        provinces = provinces.map(p => {
          if (p.id === completed.provinceId) {
            const existingBuilding = p.buildings.find(b => b.type === completed.buildingType);
            if (existingBuilding) {
              // Upgrade do edifício existente
              return {
                ...p,
                buildings: p.buildings.map(b =>
                  b.type === completed.buildingType
                    ? { ...b, level: b.level + 1, daysRemaining: 0 }
                    : b
                )
              };
            } else {
              // Novo edifício
              return {
                ...p,
                buildings: [...p.buildings, {
                  type: completed.buildingType,
                  level: 1,
                  daysRemaining: 0
                }]
              };
            }
          }
          return p;
        });

        // Mostra toast de conclusão APENAS para o jogador
        const buildingName = getBuildingName(completed.buildingType);
        const dateString = formatGameDate(snapshot.date);

        if (province.owner === playerCountryTag) {
          addToast(
            `Construção de ${buildingName} finalizada em ${province.name}!`,
            'success',
            'Obra Concluída',
            dateString
          );
        }

        // Registra no log da IA se a construção foi de um bot
        if (province.owner !== playerCountryTag) {
          const country = countries.find(c => c.tag === province.owner);
          if (country) {
            addAILog(
              country.name,
              'building',
              `Construção de ${buildingName} concluída em ${province.name}`,
              dateString,
              country.color
            );
          }
        }
      }
    }

    // ===== PASSO B: MOVIMENTAÇÃO =====
    const moveResult = processArmyMovement(armies, provinces, relations);
    armies = moveResult.updatedArmies;
    const arrivedArmies = moveResult.arrivedArmies;
    provinces = moveResult.updatedProvinces; // Atualiza províncias capturadas

    // ===== PASSO C: DETECÇÃO E RESOLUÇÃO DE BATALHA =====
    // C.1: Processa exércitos que chegaram ao destino
    for (const arrived of arrivedArmies) {
      const province = provinces.find(p => p.id === arrived.location);
      if (!province) {
        armies = [...armies, arrived];
        continue;
      }

      // Verifica se está em guerra FORMAL
      const isInWar = wars.some(
        w => (w.attacker === arrived.owner && w.defender === province.owner) ||
          (w.defender === arrived.owner && w.attacker === province.owner)
      );

      // 🏴 HOSTILIDADE: rebeldes brigam com TODOS, exceto seu país de origem
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
        console.log('⚔️ [COMBAT TRIGGERED AT]:', province.id);

        // Verifica se já existe uma batalha ativa nesta província
        const existingBattle = activeBattles.find(b => b.provinceId === province.id);

        if (!existingBattle) {
          // Coleta TODOS os exércitos atacantes (mesmo país do exército que chegou)
          const attackerArmies = armies.filter(a =>
            a.location === province.id &&
            a.owner === arrived.owner &&
            !a.inCombat
          );

          // Defensores: exércitos HOSTIS ao arrived (cobre rebeldes em província própria)
          const defenderArmies = armies.filter(a =>
            a.location === province.id &&
            a.owner !== arrived.owner &&
            !a.inCombat &&
            isHostile(arrived.owner, a.owner, arrived.originalOwner, a.originalOwner)
          );

          // Inicia nova batalha contínua com TODOS os exércitos
          const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const newBattle = startContinuousBattle(attackerArmies, defenderArmies, province, snapshot.date, battleId);

          // Marca TODOS os exércitos participantes como em combate
          const participantIds = newBattle.participantArmyIds;
          armies = armies.map(a => {
            if (participantIds.includes(a.id)) {
              return { ...a, inCombat: true };
            }
            return a;
          });

          // Adiciona batalha à lista de batalhas ativas
          setActiveBattles(prev => [...prev, newBattle]);

          addLog(`⚔️ Batalha iniciada em ${province.name}! Duração: ${newBattle.daysTotal} dias`);
          addLog(`   Atacantes: ${attackerArmies.length} exércitos (${attackerArmies.reduce((sum, a) => sum + calculateArmySize(a), 0)} tropas)`);
          addLog(`   Defensores: ${defenderArmies.length} exércitos (${defenderArmies.reduce((sum, a) => sum + calculateArmySize(a), 0)} tropas)`);

          // Se o jogador está envolvido, mostra notificação
          if (arrived.owner === playerCountryTag || province.owner === playerCountryTag) {
            addToast(
              `Batalha iniciada em ${province.name}! ${newBattle.daysTotal} dias de combate.`,
              'warning',
              'Batalha Iniciada'
            );
          }
        } else {
          // Já existe batalha - adiciona exército como reforço
          armies = [...armies, { ...arrived, inCombat: true }];
          console.log(`🛡️ Reforço adicionado à batalha em ${province.name}`);
        }
        continue;
      }

      // Se não há inimigos, adiciona o exército normalmente
      armies = [...armies, arrived];

      if (province.owner !== arrived.owner && shouldBattle) {
        const oldOwner = province.owner;

        // 🏴 Determina o novo dono: se é rebelde, devolve ao originalOwner
        const newOwner = (isRebelArrived && arrived.originalOwner)
          ? arrived.originalOwner
          : arrived.owner;

        provinces = provinces.map(p => {
          if (p.id === province.id) {
            // Aplica unrest inicial na província ocupada
            const conqueredProv = applyConquestUnrest({ ...p, owner: newOwner }, snapshot.date);
            return {
              ...conqueredProv,
              originalOwner: conqueredProv.originalOwner || oldOwner,
            };
          }
          return p;
        });

        countries = countries.map(c => {
          if (c.tag === newOwner) return { ...c, provinces: [...c.provinces, province.id] };
          if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
          return c;
        });

        // Cancela recrutamentos e construções na província ocupada
        const cancelResult = cancelProvinceActivities(
          province.id,
          oldOwner,
          newOwner,
          recruitments,
          buildingConstructions,
          provinces
        );

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

    // Usa as batalhas atualizadas (incluindo reforços adicionados)
    let currentActiveBattles = [...autoCombatResult.updatedBattles];

    // Adiciona novas batalhas à lista de batalhas ativas
    if (autoCombatResult.newBattles.length > 0) {
      currentActiveBattles = [...currentActiveBattles, ...autoCombatResult.newBattles];

      // Notifica o jogador sobre novas batalhas
      for (const newBattle of autoCombatResult.newBattles) {
        const province = provinces.find(p => p.id === newBattle.provinceId);
        const attacker = armies.find(a => a.id === newBattle.attackerArmyId);
        const defender = armies.find(a => a.id === newBattle.defenderArmyId);

        if (province && attacker && defender) {
          addLog(`⚔️ Batalha iniciada em ${province.name}! Duração: ${newBattle.daysTotal} dias`);

          if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
            addToast(
              `Batalha iniciada em ${province.name}! ${newBattle.daysTotal} dias de combate.`,
              'warning',
              'Batalha Iniciada'
            );
          }
        }
      }
    }

    // Notifica sobre reforços adicionados
    if (autoCombatResult.reinforcementsAdded.length > 0) {
      for (const reinforcement of autoCombatResult.reinforcementsAdded) {
        const sideLabel = reinforcement.side === 'attacker' ? 'atacante' : 'defensor';
        addLog(`⚔️ Reforço: ${reinforcement.armyOwner} enviou ${reinforcement.troops} tropas para ${reinforcement.provinceName} (lado ${sideLabel})`);

        // Notifica o jogador se for seu exército
        if (reinforcement.armyOwner === playerCountryTag) {
          addToast(
            `Exército entrou como reforço em ${reinforcement.provinceName}! (+${reinforcement.troops} tropas)`,
            'info',
            'Reforço Adicionado'
          );
        }
      }
    }

    // C.3: Processa batalhas contínuas ativas
    const finishedBattles: ActiveBattle[] = [];
    const stillActiveBattles: ActiveBattle[] = [];

    console.log(`📊 Processando ${currentActiveBattles.length} batalhas ativas`);

    for (const battle of currentActiveBattles) {
      const province = provinces.find(p => p.id === battle.provinceId);
      const attacker = armies.find(a => a.id === battle.attackerArmyId);
      const defender = armies.find(a => a.id === battle.defenderArmyId);

      if (!province || !attacker || !defender) {
        // Batalha inválida - não adiciona de volta
        console.warn(`⚠️ Batalha inválida removida: ${battle.id}`);
        continue;
      }

      console.log(`⚙️ Processando batalha ${battle.id} em ${province.name}`);

      // Processa um dia de batalha
      const result = processDailyBattle(battle, attacker, defender, province);

      // Atualiza exércitos com tropas reduzidas
      armies = armies.map(a => {
        if (a.id === attacker.id) return result.attacker;
        if (a.id === defender.id) return result.defender;
        return a;
      });

      // Verifica se a batalha terminou
      if (result.finished) {
        // Adiciona à lista de batalhas finalizadas
        finishedBattles.push(result.battle);
        console.log(`✅ Batalha ${battle.id} finalizada - será processada`);
      } else {
        // Batalha continua - atualiza e mantém na lista de ativas
        stillActiveBattles.push(result.battle);
        console.log(`⏳ Batalha ${battle.id} continua - ${result.battle.daysRemaining} dias restantes`);
      }
    }

    // Atualiza lista de batalhas ativas (apenas as que não terminaram)
    currentActiveBattles = stillActiveBattles;
    console.log(`📊 ${finishedBattles.length} batalhas finalizadas, ${stillActiveBattles.length} ainda ativas`);

    // Finaliza batalhas concluídas
    if (finishedBattles.length > 0) {
      console.log(`🏁 Processando ${finishedBattles.length} batalhas finalizadas`);
    }

    for (const finishedBattle of finishedBattles) {
      const province = provinces.find(p => p.id === finishedBattle.provinceId);
      const attacker = armies.find(a => a.id === finishedBattle.attackerArmyId);
      const defender = armies.find(a => a.id === finishedBattle.defenderArmyId);

      if (!province || !attacker || !defender) {
        console.warn(`⚠️ Batalha finalizada sem exércitos/província: ${finishedBattle.id}`);
        continue;
      }

      console.log(`🏁 Finalizando batalha ${finishedBattle.id} em ${province.name}`);
      console.log(`   Atacante: ${attacker.owner} (${finishedBattle.attackerCurrentTroops} tropas restantes)`);
      console.log(`   Defensor: ${defender.owner} (${finishedBattle.defenderCurrentTroops} tropas restantes)`);
      console.log(`   Participantes: ${finishedBattle.participantArmyIds.length} exércitos`);

      // Finaliza a batalha e obtém o resultado
      const { result: finalResult } = finalizeBattle(
        finishedBattle, attacker, defender, province, snapshot.date, armies
      );

      console.log(`🏆 Vencedor: ${finalResult.winner === 'attacker' ? attacker.owner : defender.owner}`);

      // 🔓 PROCESSA TODOS OS EXÉRCITOS PARTICIPANTES
      const participantIds = finishedBattle.participantArmyIds;
      console.log(`🔓 Processando ${participantIds.length} exércitos participantes: ${participantIds.join(', ')}`);

      // Determina quais países são vencedores e perdedores
      const winnerSide = finalResult.winner;
      const winnerCountry = winnerSide === 'attacker' ? finalResult.attacker.owner : finalResult.defender.owner;
      const loserCountry = winnerSide === 'attacker' ? finalResult.defender.owner : finalResult.attacker.owner;

      // Calcula o novo estado dos exércitos ANTES de atualizar
      const updatedArmiesList = armies.map(army => {
        // Se não é participante, mantém como está
        if (!participantIds.includes(army.id)) {
          return army;
        }

        // Se é participante, verifica se sobreviveu
        const hasTroops = army.regiments.length > 0 && army.regiments.some(r => r.strength > 0);

        if (!hasTroops) {
          // Exército foi eliminado - marca para remoção
          console.log(`💀 Exército ${army.id} (${army.owner}) foi eliminado`);
          return null;
        }

        // Exército sobreviveu - libera do combate
        const isWinner = army.owner === winnerCountry;
        const isLoser = army.owner === loserCountry;

        if (isWinner) {
          // Vencedor: permanece na província
          console.log(`✅ Exército ${army.id} (${army.owner}) venceu e permanece em ${province.name}`);
          return { ...army, inCombat: false };
        } else if (isLoser) {
          // Perdedor: verifica se deve recuar
          const retreatProvince = findRetreatProvince(army.owner, province, provinces);
          if (retreatProvince) {
            // Recua para província vizinha amigável
            console.log(`🏃 Exército ${army.id} (${army.owner}) recua para ${retreatProvince.name}`);
            return { ...army, inCombat: false, location: retreatProvince.id };
          } else {
            // Sem rota de fuga - aniquilado
            console.log(`💀 Exército ${army.id} (${army.owner}) aniquilado - sem rota de fuga`);
            return null;
          }
        }

        return army;
      }).filter(Boolean) as Army[]; // Remove exércitos eliminados

      console.log(`✅ EXÉRCITOS SALVOS: ${updatedArmiesList.filter(a => participantIds.includes(a.id)).length} exércitos mantidos com inCombat = false`);

      // Atualiza o estado dos exércitos
      armies = updatedArmiesList;
      setArmies(updatedArmiesList);

      // Atualiza guerras com baixas
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

      // Processa resultado (vencedor/perdedor)
      if (finalResult.winner === 'attacker') {
        // REGRA: A província só muda de dono se NÃO houver mais exércitos defensores
        const remainingDefenders = armies.filter(a =>
          a.location === province.id &&
          a.owner === defender.owner &&
          !a.inCombat
        );

        if (remainingDefenders.length === 0) {
          // Não há defensores restantes - província muda de dono
          const oldOwner = province.owner;

          // 🏴 Verifica se o vencedor é REBELDE → devolve ao originalOwner
          const rebelReturnOwner = checkRebelTerritoryReturn(attacker);
          const newProvinceOwner = rebelReturnOwner || attacker.owner;

          provinces = provinces.map(p => {
            if (p.id === province.id) {
              // Aplica unrest inicial na província conquistada
              const conqueredProvince = applyConquestUnrest({ ...p, owner: newProvinceOwner }, snapshot.date);
              return {
                ...conqueredProvince,
                originalOwner: conqueredProvince.originalOwner || oldOwner,
              };
            }
            return p;
          });

          // Atualiza listas de províncias dos países
          countries = countries.map(c => {
            if (c.tag === newProvinceOwner) return { ...c, provinces: [...c.provinces, province.id] };
            if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
            return c;
          });

          // 🧹 LIMPEZA AUTOMÁTICA: Usa a função cancelProvinceActivities
          const cancelResult = cancelProvinceActivities(
            province.id,
            oldOwner,
            attacker.owner,
            recruitments,
            buildingConstructions,
            provinces
          );

          recruitments = cancelResult.recruitments;
          buildingConstructions = cancelResult.constructions;
          provinces = cancelResult.provinces;
          const updatedFinalResult = { ...finalResult, territoryChanged: true, newOwner: newProvinceOwner };
          if (rebelReturnOwner) {
            const countryName = allCountries.find(c => c.tag === rebelReturnOwner)?.name || rebelReturnOwner;
            addLog(`🏴 Rebeldes libertaram ${province.name}! Devolvida a ${countryName}!`);
          } else {
            addLog(`⚔️ ${attacker.owner} conquistou ${province.name} de ${oldOwner}!`);
          }
          setBattleHistory(prev => [updatedFinalResult, ...prev]);

          if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
            setBattleReport(updatedFinalResult);
            setIsPaused(true);
          }
        } else {
          // Ainda há defensores - província NÃO muda de dono
          const updatedFinalResult = { ...finalResult, territoryChanged: false };

          addLog(`🛡️ ${attacker.owner} venceu a batalha, mas ${defender.owner} ainda defende ${province.name}!`);
          addLog(`   Defensores restantes: ${remainingDefenders.length} exércitos`);
          setBattleHistory(prev => [updatedFinalResult, ...prev]);

          if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
            setBattleReport(updatedFinalResult);
            setIsPaused(true);
          }
        }
      } else {
        // Defensor venceu
        addLog(`🛡️ ${defender.owner} defendeu ${province.name}!`);

        // Log de recuo do atacante perdedor
        const retreatProvince = findRetreatProvince(attacker.owner, province, provinces);
        if (retreatProvince && finalResult.attacker.regiments.length > 0) {
          addLog(`🏃 ${attacker.owner} recuou para ${retreatProvince.name}`);
        } else {
          addLog(`💀 ${attacker.owner} aniquilado em ${province.name}`);
        }

        setBattleHistory(prev => [finalResult, ...prev]);

        if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
          setBattleReport(finalResult);
          setIsPaused(true);
        }
      }

      // 🏆 APLICA MUDANÇAS DE ESTABILIDADE E PRESTÍGIO
      // Vencedor ganha prestígio
      countries = countries.map(c => {
        if (c.tag === winnerCountry) {
          return applyStabilityPrestigeChanges(c, 0, 2); // +2 prestígio
        }
        if (c.tag === loserCountry) {
          return applyStabilityPrestigeChanges(c, 0, -3); // -3 prestígio
        }
        return c;
      });

      // Se houve conquista de província, aplica bônus/penalidade adicional
      if (finalResult.territoryChanged) {
        countries = countries.map(c => {
          if (c.tag === winnerCountry) {
            return applyStabilityPrestigeChanges(c, 2, 5); // +2 estabilidade, +5 prestígio
          }
          if (c.tag === loserCountry) {
            return applyStabilityPrestigeChanges(c, -5, -5); // -5 estabilidade, -5 prestígio
          }
          return c;
        });
      }

      // ✅ Verificação final: confirma que todos os sobreviventes foram liberados
      const survivingCount = participantIds.filter(id => {
        const army = updatedArmiesList.find(a => a.id === id);
        return army && army.regiments.length > 0 && army.regiments.some(r => r.strength > 0);
      }).length;
      console.log(`✅ VERIFICAÇÃO: ${survivingCount}/${participantIds.length} exércitos sobreviventes liberados com inCombat = false`);
    }

    // Atualiza estado de batalhas ativas
    setActiveBattles(currentActiveBattles);
    activeBattlesRef.current = currentActiveBattles;
    console.log(`✅ Estado atualizado: ${currentActiveBattles.length} batalhas ativas restantes`);

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
        const economicResult = processAIEconomicDecisions(
          country,
          provinces,
          botTechState,
          buildingConstructions,
          recruitments,
          dateString
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

      const existingBattle = currentActiveBattles.find(b => b.provinceId === prov.id);
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
    activeBattlesRef.current = activeBattles;
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
   * Adiciona uma construção à fila
   */
  const handleBuild = useCallback(
    (provinceId: string, buildingType: BuildingType) => {
      const province = provinces.find((p) => p.id === provinceId);
      if (!province || province.owner !== playerCountryTag) return;

      const existingBuilding = province.buildings.find((b) => b.type === buildingType);
      const currentLevel = existingBuilding?.level ?? 0;

      const cost = getBuildingCost(buildingType, currentLevel);
      const buildTime = getBuildingTime(buildingType, currentLevel);

      const result = queueBuilding(
        provinceId,
        playerCountryTag,
        buildingType,
        buildTime,
        cost,
        buildingConstructions,
        playerCountry.resources.gold
      );

      if (result.success) {
        setBuildingConstructions(result.updatedConstructions);
        setAllCountries((prev) =>
          prev.map((c) =>
            c.tag === playerCountryTag
              ? { ...c, resources: { ...c.resources, gold: result.newGold } }
              : c
          )
        );
        // Toast removido - notificação será disparada apenas na conclusão
      } else {
        addToast(
          `Ouro insuficiente para construir ${buildingType}`,
          'error',
          'Erro'
        );
      }
    },
    [provinces, playerCountryTag, playerCountry.resources.gold, buildingConstructions, addToast]
  );

  /**
   * Cancela uma construção da fila
   */
  const handleCancelBuilding = useCallback(
    (constructionId: string) => {
      const result = cancelBuilding(constructionId, buildingConstructions, playerCountry.resources.gold);

      setBuildingConstructions(result.updatedConstructions);
      setAllCountries((prev) =>
        prev.map((c) =>
          c.tag === playerCountryTag
            ? { ...c, resources: { ...c.resources, gold: result.newGold } }
            : c
        )
      );

      if (result.refundedGold > 0) {
        addToast(
          `Construção cancelada. +${result.refundedGold} Ouro reembolsado!`,
          'success',
          'Reembolso',
          formatGameDate(dateRef.current)
        );
      }
    },
    [buildingConstructions, playerCountry.resources.gold, playerCountryTag, addToast, formatGameDate]
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

      // Aplica multiplicador de custo do exército baseado na lei de recrutamento
      const conscriptionLaw = LAWS[playerCountry.activeLaws?.conscription || 'conscription_peacetime'];
      const armyCostMultiplier = conscriptionLaw?.bonuses.armyCostMultiplier ?? 1.0;
      const adjustedGoldCost = Math.floor(costs.gold * armyCostMultiplier);

      console.log('💰 Custos:', costs);
      console.log('💰 Custo ajustado (lei):', adjustedGoldCost);
      console.log('💰 Recursos atuais:', { gold: playerCountry.resources.gold, manpower: playerCountry.resources.manpower });

      // Verifica recursos (usando custo ajustado)
      if (playerCountry.resources.gold < adjustedGoldCost) {
        console.log('❌ Ouro insuficiente');
        addLog(`❌ Ouro insuficiente para recrutar ${unitType}`);
        return;
      }
      if (playerCountry.resources.manpower < costs.manpower) {
        console.log('❌ Manpower insuficiente');
        addLog(`❌ Manpower insuficiente para recrutar ${unitType}`);
        return;
      }

      // Deduz recursos (usando custo ajustado pela lei)
      setAllCountries((prev) =>
        prev.map((c) =>
          c.tag === playerCountryTag
            ? {
              ...c,
              resources: {
                ...c.resources,
                gold: c.resources.gold - adjustedGoldCost,
                manpower: c.resources.manpower - costs.manpower,
              },
            }
            : c
        )
      );

      // Adiciona recrutamento (agrupando se já existir idêntico)
      setRecruitments((prev) => {
        // Verifica se já existe um recrutamento idêntico
        const existingRecruitment = prev.find(
          r => r.owner === playerCountryTag &&
            r.provinceId === provinceId &&
            r.unitType === unitType &&
            r.daysRemaining === costs.days
        );

        if (existingRecruitment) {
          // Incrementa a quantidade
          console.log('✅ Agrupando recrutamento:', existingRecruitment.id, 'count:', existingRecruitment.count + 1);
          // Toast removido - notificação será disparada apenas na conclusão
          return prev.map(r =>
            r.id === existingRecruitment.id ? { ...r, count: r.count + 1 } : r
          );
        } else {
          // Cria novo item com count = 1
          const newRecruitment: Recruitment = {
            id: generateRecruitmentId(),
            provinceId,
            owner: playerCountryTag,
            unitType,
            daysRemaining: costs.days,
            count: 1,
          };
          console.log('✅ Adicionando recrutamento à fila:', newRecruitment);
          // Toast removido - notificação será disparada apenas na conclusão
          return [...prev, newRecruitment];
        }
      });
    },
    [provinces, playerCountryTag, playerCountry]
  );

  /**
   * Cancela um recrutamento e reembolsa ouro proporcionalmente
   */
  const handleCancelRecruitment = useCallback(
    (recruitmentId: string) => {
      const rec = recruitments.find(r => r.id === recruitmentId);
      if (!rec) return;

      const result = cancelRecruitment(recruitmentId, recruitments, playerCountry.resources.gold);

      // Atualiza recrutamentos
      setRecruitments(result.updatedRecruitments);

      // Reembolsa ouro
      setAllCountries((prev) =>
        prev.map((c) =>
          c.tag === playerCountryTag
            ? {
              ...c,
              resources: {
                ...c.resources,
                gold: result.newGold,
              },
            }
            : c
        )
      );

      if (result.refundedGold > 0) {
        addToast(
          `Recrutamento cancelado. +${result.refundedGold} Ouro reembolsado!`,
          'success',
          'Reembolso',
          formatGameDate(dateRef.current)
        );
      }
    },
    [recruitments, playerCountry, playerCountryTag, addToast, formatGameDate]
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
   * Se clicar na província atual do exército que está se movendo, para o movimento
   */
  const handleProvinceRightClick = useCallback(
    (provinceId: string) => {
      if (!selectedArmy) return;

      const army = armiesRef.current.find((a) => a.id === selectedArmy);
      if (!army || army.owner !== playerCountryTag) return;

      // Se o exército está se movendo e o jogador clica na província atual, para o movimento
      if (army.destination && army.location === provinceId) {
        const updatedArmy = stopArmyMovement(army);
        if (updatedArmy !== army) {
          setArmies((prev) => prev.map((a) => (a.id === army.id ? updatedArmy : a)));
          const currentProvince = provincesRef.current.find(p => p.id === provinceId);
          addLog(`🛑 ${army.name} parou em ${currentProvince?.name ?? provinceId}`);
          addToast(
            `Exército parou em ${currentProvince?.name ?? provinceId}`,
            'info',
            'Movimento Cancelado'
          );
        }
        return;
      }

      // Se já está se movendo para outro lugar, não permite novo movimento
      if (army.destination) return;

      const moved = moveArmy(army, provinceId, provincesRef.current, diplomaticRelationsRef.current);
      if (moved) {
        setArmies((prev) => prev.map((a) => (a.id === army.id ? moved : a)));
        const destProvince = provincesRef.current.find(p => p.id === provinceId);
        addLog(`🚶 ${army.name} marchando para ${destProvince?.name ?? provinceId}`);
      } else {
        addLog(`❌ Movimento não permitido: sem relação de guerra com o destino`);
      }
    },
    [selectedArmy, playerCountryTag, addLog, addToast]
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

  /**
   * Handler para continuar jogando após fim de jogo
   */
  const handleEndGameContinue = useCallback(() => {
    setEndGameType(null);
    setIsPaused(false);
    addLog('🎮 Continuando no modo sandbox...');
  }, [addLog]);

  /**
   * Handler para reiniciar a partida
   */
  const handleEndGameRestart = useCallback(() => {
    // Recarrega a página para reiniciar completamente
    window.location.reload();
  }, []);

  /**
   * Handler para recuo manual de exército durante batalha
   */
  const handleRetreatArmy = useCallback((armyId: string, battleId: string) => {
    const result = retreatArmyManually(armyId, battleId, armies, activeBattles, provinces);

    if (result.retreatSuccess) {
      setArmies(result.armies);
      setActiveBattles(result.activeBattles);
      activeBattlesRef.current = result.activeBattles;

      const army = armies.find(a => a.id === armyId);
      const battle = activeBattles.find(b => b.id === battleId);
      const province = provinces.find(p => p.id === battle?.provinceId);

      if (army && province) {
        addLog(`🏃 ${army.owner} recuou exército de ${province.name}`);
        addToast(
          `Exército recuou com sucesso!`,
          'success',
          'Recuo Manual'
        );
      }

      if (result.battleEnded) {
        const winnerSide = result.winner === 'attacker' ? 'Atacante' : 'Defensor';
        addLog(`🏁 Batalha finalizada - ${winnerSide} venceu por recuo total do oponente`);
        addToast(
          `Batalha finalizada! ${winnerSide} venceu.`,
          'info',
          'Fim da Batalha'
        );
      }
    } else {
      addToast(
        `Não foi possível recuar o exército`,
        'error',
        'Erro de Recuo'
      );
    }
  }, [armies, activeBattles, provinces, addLog, addToast]);

  /**
   * Handler para parar o movimento de um exército
   */
  const handleStopMovement = useCallback((armyId: string) => {
    const army = armies.find(a => a.id === armyId);
    if (!army) return;

    // Usa a função do motor militar
    const updatedArmy = stopArmyMovement(army);

    // Se o exército não mudou, não faz nada
    if (updatedArmy === army) {
      addToast(
        `Não é possível parar o movimento agora`,
        'warning',
        'Movimento Não Interrompido'
      );
      return;
    }

    // Atualiza o exército no estado
    setArmies(prev => prev.map(a => a.id === armyId ? updatedArmy : a));

    const province = provinces.find(p => p.id === army.location);
    const provinceName = province?.name || 'província desconhecida';

    addLog(`🛑 Exército parou em ${provinceName}`);
    addToast(
      `Exército parou em ${provinceName}`,
      'info',
      'Movimento Cancelado'
    );
  }, [armies, provinces, addLog, addToast]);

  /**
   * Handler para mudar a dificuldade da IA
   */
  const handleDifficultyChange = useCallback((newDifficulty: AIDifficulty) => {
    setAiDifficulty(newDifficulty);
    addToast(
      `Dificuldade da IA alterada para: ${DIFFICULTY_DESCRIPTIONS[newDifficulty]}`,
      'info',
      'Configuração Alterada'
    );
  }, [addToast]);

  /**
   * Handler para promulgar uma nova lei
   */
  const handleEnactLaw = useCallback((category: LawCategory, lawId: string) => {
    const law = LAWS[lawId];
    if (!law) return;

    // Verifica se o jogador tem ouro suficiente
    if (playerCountry.resources.gold < law.costGold) {
      addToast('Ouro insuficiente para promulgar esta lei', 'error', 'Erro');
      return;
    }

    // Deduz o custo
    setAllCountries((prev) =>
      prev.map((c) =>
        c.tag === playerCountryTag
          ? {
            ...c,
            resources: {
              ...c.resources,
              gold: c.resources.gold - law.costGold,
            },
            activeLaws: {
              ...c.activeLaws,
              [category]: lawId,
            },
          }
          : c
      )
    );

    addToast(
      `Lei "${law.name}" promulgada com sucesso!`,
      'success',
      'Nova Lei'
    );
  }, [playerCountry, playerCountryTag, addToast]);

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
        onSettingsClick={() => setShowSettingsModal(true)}
        onGovernmentClick={() => setShowGovernmentModal(true)}
      />

      {/* === Área Principal === */}
      <div className="game__main">
        {/* === Mapa === */}
        <GameMap
          provinces={provinces}
          countries={allCountries}
          armies={armies}
          recruitments={recruitments}
          buildingConstructions={buildingConstructions}
          activeBattles={activeBattles}
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
            buildingConstructions={buildingConstructions}
            onClose={handleClosePanel}
            onProvinceClick={handleProvinceClick}
            onBuild={handleBuild}
            onRecruit={handleRecruit}
            onCancelRecruitment={handleCancelRecruitment}
            onCancelBuilding={handleCancelBuilding}
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

              {/* === Ação: Parar Movimento (apenas se estiver se movendo) === */}
              {selectedArmyData.destination && selectedArmyData.owner === playerCountryTag && !selectedArmyData.inCombat && (
                <div className="army-info-panel__actions-section">
                  <strong>🛑 Cancelar Movimento:</strong>
                  <button
                    className="army-info-panel__action-btn army-info-panel__action-btn--stop"
                    onClick={() => handleStopMovement(selectedArmyData.id)}
                    title="Parar marcha e fixar posição na província atual"
                  >
                    🛑 Parar Marcha
                  </button>
                </div>
              )}

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

              {/* === Ação: Recuo Manual (apenas em combate) === */}
              {selectedArmyData.inCombat && selectedArmyData.owner === playerCountryTag && (() => {
                const battle = activeBattles.find(b =>
                  b.provinceId === selectedArmyData.location &&
                  b.participantArmyIds.includes(selectedArmyData.id)
                );

                if (!battle) return null;

                return (
                  <div className="army-info-panel__actions-section">
                    <strong>🏃 Recuo Manual:</strong>
                    <button
                      className="army-info-panel__action-btn army-info-panel__action-btn--retreat"
                      onClick={() => handleRetreatArmy(selectedArmyData.id, battle.id)}
                      title="Recuar exército para província vizinha amigável"
                    >
                      🏃 Recuar Exército
                    </button>
                  </div>
                );
              })()}

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
                      className={`split-modal__regiment-btn ${splitSelection.has(i) ? 'split-modal__regiment-btn--selected' : ''
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

        {/* === Modal de Fim de Jogo === */}
        {endGameType && gameStats && (
          <EndGameModal
            endGameType={endGameType}
            stats={gameStats}
            onContinue={handleEndGameContinue}
            onRestart={handleEndGameRestart}
          />
        )}

        {/* === Modal de Histórico de Notificações === */}
        <NotificationLogModal
          isOpen={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
        />

        {/* === Modal de Configurações === */}
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          aiDifficulty={aiDifficulty}
          onDifficultyChange={handleDifficultyChange}
        />

        {/* === Modal de Log da IA === */}
        <AILogModal
          isOpen={showAILogModal}
          onClose={() => setShowAILogModal(false)}
        />

        {/* === Modal de Governo === */}
        {showGovernmentModal && (
          <GovernmentModal
            playerCountry={playerCountry}
            onEnactLaw={handleEnactLaw}
            onClose={() => setShowGovernmentModal(false)}
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
          <span className="game__bottom-label">Avisos:</span>
          <button
            className="game__bottom-notifications-btn"
            onClick={() => {
              setShowNotificationModal(true);
              markAllAsRead();
            }}
            title="Ver histórico de avisos"
          >
            🔔 {unreadCount > 0 ? (
              <span className="game__bottom-notifications-badge">{unreadCount}</span>
            ) : (
              notificationHistory.length
            )}
          </button>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Log IA:</span>
          <button
            className="game__bottom-ai-log-btn"
            onClick={() => setShowAILogModal(true)}
            title="Ver log de atividades da IA"
          >
            🤖 IA
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

      {/* === Container de Toasts === */}
      <ToastContainer />
    </div>
  );
};

// Wrapper com ToastProvider e AILogProvider
const AppWithProviders: React.FC = () => {
  return (
    <ToastProvider>
      <AILogProvider>
        <App />
      </AILogProvider>
    </ToastProvider>
  );
};

export default AppWithProviders;
