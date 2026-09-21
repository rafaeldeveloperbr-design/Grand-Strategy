/**
 * ============================================================
 * MÓDULO 3 - Componente Principal do Jogo
 * ============================================================
 * Ponto de entrada da aplicação. Gerencia o estado global do jogo
 * e orquestra a renderização de todos os módulos:
 * - TopBar (barra superior com dados do país e economia)
 * - GameMap (mapa interativo com províncias e exércitos)
 * - ProvincePanel (painel lateral com construções e recrutamento)
 * 
 * Inclui o game loop que processa:
 * - Economia (renda/despesas)
 * - Crescimento populacional
 * - Construção de edifícios
 * - Recrutamento militar
 * - Movimentação de exércitos
 * - Combate e conquista
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { GameMap } from './components/GameMap';
import { ProvincePanel } from './components/ProvincePanel';
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
import { resolveBattle, calculateArmySize } from './engine/combat';
import { getRecruitmentCost } from './data/units';
import { getBuildingCost, getBuildingTime } from './data/buildings';
import {
  BuildingType,
  Country,
  Province,
  GameDate,
  Army,
  Recruitment,
  UnitType,
} from './types';
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
import { DiplomacyPanel } from './components/DiplomacyPanel';
import { WarPanel } from './components/WarPanel';

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

  /** Refs para game loop */
  const gameLoopRef = useRef<number | null>(null);
  const provincesRef = useRef(provinces);
  const countriesRef = useRef(allCountries);
  const armiesRef = useRef(armies);
  const recruitmentsRef = useRef(recruitments);

  useEffect(() => { provincesRef.current = provinces; }, [provinces]);
  useEffect(() => { countriesRef.current = allCountries; }, [allCountries]);
  useEffect(() => { armiesRef.current = armies; }, [armies]);
  useEffect(() => { recruitmentsRef.current = recruitments; }, [recruitments]);

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
   * Processa um tick completo do jogo
   */
  const processTick = useCallback(() => {
    const currentProvinces = provincesRef.current;
    const currentCountries = countriesRef.current;
    const currentArmies = armiesRef.current;
    const currentRecruitments = recruitmentsRef.current;

    // 1. Avança a data
    setDate((prevDate) => advanceDate(prevDate));

    // 2. Processa economia
    const updatedCountries = currentCountries.map((country) => {
      const countryProvinces = currentProvinces.filter(p => p.owner === country.tag);
      const { country: updatedCountry, provinces: updatedProvs } =
        processDailyTick(country, countryProvinces);

      setProvinces((prevProvs) => {
        const newProvs = [...prevProvs];
        for (const updatedProv of updatedProvs) {
          const idx = newProvs.findIndex((p) => p.id === updatedProv.id);
          if (idx !== -1) newProvs[idx] = updatedProv;
        }
        return newProvs;
      });

      return updatedCountry;
    });
    setAllCountries(updatedCountries);

    // 3. Processa recrutamentos
    const { recruitments: updatedRecruitments, armies: armiesAfterRecruit } =
      processRecruitments(currentRecruitments, currentArmies, updatedCountries);
    setRecruitments(updatedRecruitments);

    // 4. Processa movimentação
    const { armies: movingArmies, arrivedArmies } =
      processArmyMovement(armiesAfterRecruit, currentProvinces);

    let finalArmies = movingArmies;

    // 5. Processa chegadas e combate (apenas se estiver em guerra)
    if (arrivedArmies.length > 0) {
      for (const arrived of arrivedArmies) {
        const province = currentProvinces.find(p => p.id === arrived.location);
        if (!province) {
          finalArmies.push(arrived);
          continue;
        }

        // Verifica se está em guerra com o dono da província
        const isInWar = wars.some(
          w => (w.attacker === arrived.owner && w.defender === province.owner) ||
               (w.defender === arrived.owner && w.attacker === province.owner)
        );

        // Se não está em guerra, não pode atacar
        if (province.owner !== arrived.owner && !isInWar) {
          finalArmies.push(arrived);
          continue;
        }

        // Verifica se há inimigos na província
        const enemies = getEnemyArmiesInProvince(finalArmies, arrived.location!, arrived.owner);

        if (enemies.length > 0) {
          // COMBATE!
          const enemy = enemies[0];
          const result = resolveBattle(arrived, enemy, province);

          // Atualiza exércitos após combate
          finalArmies = finalArmies.filter(a => a.id !== arrived.id && a.id !== enemy.id);

          // Atualiza baixas na guerra
          setWars(prevWars => prevWars.map(w => {
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
          }));

          if (result.winner === 'attacker') {
            if (result.attacker.regiments.length > 0) {
              finalArmies.push({ ...result.attacker, location: arrived.location });
            }
            // Conquista a província!
            const oldOwner = province.owner;
            setProvinces((prev) =>
              prev.map((p) =>
                p.id === province.id ? { ...p, owner: arrived.owner } : p
              )
            );
            setAllCountries((prev) =>
              prev.map((c) => {
                if (c.tag === arrived.owner) {
                  return { ...c, provinces: [...c.provinces, province.id] };
                }
                if (c.tag === oldOwner) {
                  return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
                }
                return c;
              })
            );
            addLog(`⚔️ ${arrived.owner} conquistou ${province.name} de ${oldOwner}!`);
          } else {
            if (result.defender.regiments.length > 0) {
              finalArmies.push({ ...result.defender, location: arrived.location });
            }
            addLog(`🛡️ ${enemy.owner} defendeu ${province.name} contra ${arrived.owner}!`);
          }
        } else {
          // Sem inimigos - ocupa a província (se em guerra)
          finalArmies.push(arrived);

          if (province.owner !== arrived.owner && isInWar) {
            const oldOwner = province.owner;
            setProvinces((prev) =>
              prev.map((p) =>
                p.id === province.id ? { ...p, owner: arrived.owner } : p
              )
            );
            setAllCountries((prev) =>
              prev.map((c) => {
                if (c.tag === arrived.owner) {
                  return { ...c, provinces: [...c.provinces, province.id] };
                }
                if (c.tag === oldOwner) {
                  return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
                }
                return c;
              })
            );
            addLog(`🏳️ ${arrived.owner} ocupou ${province.name} (sem resistência)`);
          }
        }
      }
    }

    setArmies(finalArmies);

    // 6. Processa diplomacia (tick diário)
    setDiplomaticRelations(prev => processDiplomacyTick(prev));

    // 7. Atualiza War Score baseado em províncias ocupadas
    setWars(prevWars => {
      const currentProvinces = provincesRef.current;
      return prevWars.map(war => {
        const attackerProvinces = currentProvinces.filter(p => p.owner === war.attacker).map(p => p.id);
        const defenderProvinces = currentProvinces.filter(p => p.owner === war.defender).map(p => p.id);
        
        // Províncias originalmente do atacante/defensor (simplificado: todas as atuais)
        const occupiedByAttacker = defenderProvinces.filter(
          pId => !currentProvinces.find(p => p.id === pId && p.owner === war.defender)
        );
        
        return {
          ...war,
          occupiedByAttacker: currentProvinces.filter(p => p.owner === war.attacker && war.defender === 'IMP' ? false : true).map(p => p.id).slice(0, 0), // Simplificado
          warScore: attackerProvinces.length - defenderProvinces.length
        };
      });
    });

    // 8. Processa IA dos bots (a cada 10 ticks para performance)
    const currentDate = date;
    setAllCountries(prevCountries => {
      let currentArmies = armiesRef.current;
      let currentRelations = diplomaticRelations;
      let currentWars = wars;
      let currentProvinces = provincesRef.current;
      
      const updatedCountries = prevCountries.map(country => {
        if (country.tag === playerCountryTag) return country; // Pula o jogador
        
        const result = processAITick(
          country,
          currentProvinces,
          currentArmies,
          currentRelations,
          currentWars,
          prevCountries,
          currentDate
        );
        
        currentArmies = result.armies;
        currentRelations = result.relations;
        currentWars = result.wars;
        currentProvinces = result.provinces;
        
        if (result.log) addLog(result.log);
        
        return result.country;
      });
      
      setArmies(currentArmies);
      setDiplomaticRelations(currentRelations);
      setWars(currentWars);
      setProvinces(currentProvinces);
      
      return updatedCountries;
    });
  }, [advanceDate, addLog]);

  /**
   * Gerencia o game loop
   */
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (gameSpeed > 0) {
      const interval = SPEED_INTERVALS[gameSpeed];
      gameLoopRef.current = window.setInterval(processTick, interval);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameSpeed, processTick]);

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
      const province = provinces.find((p) => p.id === provinceId);
      if (!province || province.owner !== playerCountryTag) return;

      const costs = getRecruitmentCost(unitType);

      // Verifica recursos
      if (playerCountry.resources.gold < costs.gold) return;
      if (playerCountry.resources.manpower < costs.manpower) return;

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
      setRecruitments((prev) => [...prev, newRecruitment]);
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

      const moved = moveArmy(army, provinceId, provincesRef.current);
      if (moved) {
        setArmies((prev) => prev.map((a) => (a.id === army.id ? moved : a)));
        const destProvince = provincesRef.current.find(p => p.id === provinceId);
        addLog(`🚶 ${army.name} marchando para ${destProvince?.name ?? provinceId}`);
      }
    },
    [selectedArmy, playerCountryTag, addLog]
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

  // === Renderização ===
  return (
    <div className="game">
      {/* === Barra Superior === */}
      <TopBar
        playerCountry={playerCountry}
        date={date}
        gameSpeed={gameSpeed}
        onSpeedChange={handleSpeedChange}
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
