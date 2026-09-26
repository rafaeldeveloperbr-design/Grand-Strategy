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
import { useGameRefs } from './hooks/useGameRefs'
import { useGameLoop } from './hooks/useGameLoop'
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
import { processRebelAccumulation, processSeparatistAI, checkRebelTerritoryReturn, ensureSeparatistWars, cleanupSeparatistWars } from './engine/rebellions';
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

    const {
    gameLoopRef,
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
    ceilingLogRef
  } = useGameRefs({
    provinces,
    allCountries,
    armies,
    recruitments,
    wars,
    diplomaticRelations,
    date,
    buildingConstructions,
    playerTechState,
    botTechStates,
    aiDifficulty,
    activeBattles
  })

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

  
  useGameLoop({
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
})

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
