import { useCallback, useEffect } from 'react';
import { provincesData } from '../data/provinces';
import { countries as initialCountries } from '../data/countries';
import { processDailyTick } from '../engine/economy';
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

     // ===== PASSO B.5: CORREÇÃO DE LIBERTAÇÃO REBELDE =====
    // O processArmyMovement captura províncias para o tag rebelde (rebel_pXX).
    // Convertemos IMEDIATAMENTE em libertação: dono = originalOwner, unrest 0.
    if (provinces.some(p => p.owner.startsWith('rebel_'))) {
      const changes: { id: string; name: string; newOwner: string }[] = [];

      provinces = provinces.map(p => {
        if (!p.owner.startsWith('rebel_')) return p;
        const rebelArmy = armies.find(a => a.owner === p.owner);
        const liberator = rebelArmy?.originalOwner || p.originalOwner;
        if (!liberator) return p;
        changes.push({ id: p.id, name: p.name, newOwner: liberator });
        return { ...p, owner: liberator, unrest: 0 };
      });

      if (changes.length > 0) {
        // Ressincroniza as listas de províncias dos países
        countries = countries.map(c => ({
          ...c,
          provinces: provinces.filter(p => p.owner === c.tag).map(p => p.id),
        }));

        for (const ch of changes) {
          const countryName = countries.find(c => c.tag === ch.newOwner)?.name || ch.newOwner;
          console.log(`🏴 Libertação corrigida: ${ch.name} → ${countryName}`);
          addLog(`🏴 ${ch.name} libertada! Devolvida a ${countryName}.`);
        }
      }
    }

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
        const existingBattle = activeBattlesRef.current.find((b: ActiveBattle) => b.provinceId === province.id);

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
            const isLiberation = isRebelArrived && newOwner === arrived.originalOwner;
            const conqueredProv = isLiberation
              ? { ...p, owner: newOwner, unrest: 0 } // 🎉 Libertação sem unrest
              : applyConquestUnrest({ ...p, owner: newOwner }, snapshot.date); return {
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
              const isLiberation = !!rebelReturnOwner;
              const conqueredProvince = isLiberation
                ? { ...p, owner: newProvinceOwner, unrest: 0 } // 🎉 Libertação: o povo celebra, sem unrest!
                : applyConquestUnrest({ ...p, owner: newProvinceOwner }, snapshot.date);
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
