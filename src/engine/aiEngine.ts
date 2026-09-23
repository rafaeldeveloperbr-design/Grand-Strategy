/**
 * ============================================================
 * MÓDULO 4 - Motor de IA (CLEAN SLATE)
 * ============================================================
 * IA minimalista e imutável com validação diplomática
 * Regra: atribuir destino para exércitos parados respeitando relações diplomáticas
 * Em tempos de paz, exércitos se posicionam estrategicamente nas fronteiras
 */

import { Army, Province, Country, BuildingType, UnitType, Recruitment, BuildingConstruction } from '../types';
import { DiplomaticRelation, War } from '../types/diplomacy';
import { CountryTechState } from '../types/technology';
import { findPath } from './military';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technologies';
import { BUILDING_DEFINITIONS, getBuildingCost, getBuildingTime } from '../data/buildings';
import { UNIT_DEFINITIONS } from '../data/units';
import { getBuildingName, getUnitName } from '../utils/translations';

/**
 * Verifica se um exército pode se mover para uma província específica
 * baseado nas relações diplomáticas.
 */
function canMoveToProvince(
  botCountryId: string,
  targetProvinceOwner: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  if (targetProvinceOwner === botCountryId) {
    return true;
  }

  if (!diplomacy || diplomacy.length === 0) {
    return false;
  }

  const relation = diplomacy.find(
    r => (r.countryA === botCountryId && r.countryB === targetProvinceOwner) ||
         (r.countryA === targetProvinceOwner && r.countryB === botCountryId)
  );

  if (!relation) {
    return false;
  }

  // Permite movimento em estado de GUERRA ou se for ALIADO (opinião >= 80)
  return relation.status === 'war' || relation.opinion >= 80;
}

/**
 * Verifica se uma província é de fronteira (tem vizinhos de outros países)
 */
function isBorderProvince(
  provinceId: string,
  provinces: Province[],
  botCountryId: string
): boolean {
  const currentProv = provinces.find(p => p.id === provinceId);
  if (!currentProv || !currentProv.neighbors) return false;

  // É fronteira se pelo menos UM vizinho pertence a outro país
  return currentProv.neighbors.some(neighborId => {
    const neighborProv = provinces.find(p => p.id === neighborId);
    return neighborProv && neighborProv.owner !== botCountryId;
  });
}

/**
 * Verifica se o país está em guerra com algum vizinho
 */
function isAtWarWithNeighbor(
  botCountryId: string,
  currentProv: Province,
  provinces: Province[],
  diplomacy: DiplomaticRelation[]
): boolean {
  return currentProv.neighbors.some(neighborId => {
    const neighborProv = provinces.find(p => p.id === neighborId);
    if (!neighborProv || neighborProv.owner === botCountryId) return false;

    const relation = diplomacy.find(
      r => (r.countryA === botCountryId && r.countryB === neighborProv.owner) ||
           (r.countryA === neighborProv.owner && r.countryB === botCountryId)
    );

    return relation ? relation.status === 'war' : false;
  });
}

/**
 * Verifica se há relação de GUERRA específica entre dois países
 */
function isAtWarWith(
  countryA: string,
  countryB: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  const relation = diplomacy.find(
    r => (r.countryA === countryA && r.countryB === countryB) ||
         (r.countryA === countryB && r.countryB === countryA)
  );

  return relation ? relation.status === 'war' : false;
}

/**
 * Cria um exército com rota completa usando pathfinding
 */
function createArmyWithRoute(
  army: Army,
  destinationId: string,
  provinces: Province[],
  botCountryId: string,
  diplomacy: DiplomaticRelation[]
): Army {
  // Valida se pode mover para o destino (diplomacia)
  const destProv = provinces.find(p => p.id === destinationId);
  if (destProv && !canMoveToProvince(botCountryId, destProv.owner, diplomacy)) {
    // Não pode mover para este destino
    return army;
  }

  // Se é vizinho direto, não precisa de pathfinding
  const currentProv = provinces.find(p => p.id === army.location);
  if (currentProv && currentProv.neighbors.includes(destinationId)) {
    return {
      ...army,
      destination: destinationId,
      targetDestination: destinationId,
      movementProgress: 0,
      path: [destinationId],
    };
  }

  // Usa pathfinding para calcular rota completa
  const path = findPath(army.location!, destinationId, provinces, botCountryId, diplomacy);
  
  if (path.length === 0) {
    // Caminho não encontrado, não move
    return army;
  }

  return {
    ...army,
    destination: path[0],
    targetDestination: destinationId,
    movementProgress: 0,
    path: path,
  };
}

/**
 * Processa IA para um bot
 * Atribui destinos apenas para exércitos PARADOS (destination === null)
 * Respeita as relações diplomáticas para validar movimentos
 * Usa pathfinding para rotas de longa distância
 * 
 * Lógica estratégica:
 * - Em guerra: ataca províncias inimigas
 * - Em paz na fronteira: fica parado (guarda)
 * - Em paz no interior: move para fronteira
 */
export function processAI(
  botCountryId: string,
  armies: Army[],
  provinces: Province[],
  diplomacy: DiplomaticRelation[],
  wars: War[] = []
): Army[] {
  // Validação básica
  if (!botCountryId || !Array.isArray(armies) || !Array.isArray(provinces) || !Array.isArray(diplomacy)) {
    return armies;
  }

  // Processa apenas exércitos do Bot que estão PARADOS
  return armies.map(army => {
    // Ignora exércitos de outros países ou que já estão se movendo
    if (army.owner !== botCountryId || army.destination !== null) {
      return army;
    }

    // Encontra província atual do exército
    const currentProv = provinces.find(p => p.id === army.location);
    if (!currentProv || !currentProv.neighbors || currentProv.neighbors.length === 0) {
      return army;
    }

    // Verifica se está em guerra com algum vizinho
    const isAtWar = isAtWarWithNeighbor(botCountryId, currentProv, provinces, diplomacy);

    // ===== CENÁRIO A: EM GUERRA ATIVA =====
    if (isAtWar) {
      // Filtra vizinhos válidos baseado nas relações diplomáticas
      const validNeighbors = currentProv.neighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        if (!prov) return false;
        return canMoveToProvince(botCountryId, prov.owner, diplomacy);
      });

      // Se não houver vizinhos válidos, exército permanece onde está
      if (validNeighbors.length === 0) {
        return army;
      }

      // Prioriza províncias de GUERRA (não aliados, não neutros)
      const warTargets = validNeighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        if (!prov) return false;
        // Só considera alvo de guerra se estiver explicitamente em guerra
        return isAtWarWith(botCountryId, prov.owner, diplomacy);
      });

      // Se houver alvos de guerra, escolhe um aleatoriamente entre eles
      if (warTargets.length > 0) {
        const chosenDestination = warTargets[Math.floor(Math.random() * warTargets.length)];
        return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
      }
    }

    // ===== CENÁRIO B: EM PAZ =====
    
    // Regra 1: Já está na fronteira? Fica PARADO guardando
    if (isBorderProvince(army.location!, provinces, botCountryId)) {
      return army; // Não move, fica parado na fronteira
    }

    // Regra 2: Está no interior? Move em direção à fronteira
    // Busca províncias vizinhas que são de fronteira
    const borderNeighbors = currentProv.neighbors.filter(neighborId => {
      const prov = provinces.find(p => p.id === neighborId);
      if (!prov) return false;
      // Só pode mover para províncias próprias
      return prov.owner === botCountryId && isBorderProvince(neighborId, provinces, botCountryId);
    });

    // Se encontrou vizinho de fronteira, move para lá
    if (borderNeighbors.length > 0) {
      const chosenDestination = borderNeighbors[Math.floor(Math.random() * borderNeighbors.length)];
      return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
    }

    // Se nenhuma vizinha é de fronteira, escolhe qualquer vizinho próprio para continuar avançando
    const ownNeighbors = currentProv.neighbors.filter(neighborId => {
      const prov = provinces.find(p => p.id === neighborId);
      return prov && prov.owner === botCountryId;
    });

    if (ownNeighbors.length > 0) {
      const chosenDestination = ownNeighbors[Math.floor(Math.random() * ownNeighbors.length)];
      return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
    }

    // Se não houver opções, fica parado
    return army;
  });
}

/**
 * Processa decisões econômicas e estratégicas da IA
 * - Seleciona focos nacionais
 * - Pesquisa tecnologias
 * - Constrói edifícios
 * - Recruta tropas
 */
export function processAIEconomicDecisions(
  country: Country,
  provinces: Province[],
  techState: CountryTechState,
  buildingConstructions: BuildingConstruction[],
  recruitments: Recruitment[],
  dateString: string
): {
  techState: CountryTechState;
  buildingConstructions: BuildingConstruction[];
  recruitments: Recruitment[];
  country: Country;
  logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus'; message: string }>;
} {
  const logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus'; message: string }> = [];
  let updatedTechState = { ...techState };
  let updatedConstructions = [...buildingConstructions];
  let updatedRecruitments = [...recruitments];
  let updatedCountry = { ...country };

  // -------------------------------------------------------------
  // 1. SELEÇÃO DE FOCO NACIONAL
  // -------------------------------------------------------------
  if (!updatedTechState.activeFocusId) {
    // Busca focos disponíveis (não concluídos e sem pré-requisitos pendentes)
    const availableFocuses = NATIONAL_FOCUSES.filter(focus => {
      if (focus.completed) return false;
      if (updatedTechState.completedFocuses.includes(focus.id)) return false;
      
      // Verifica pré-requisitos
      if (focus.prerequisites && focus.prerequisites.length > 0) {
        return focus.prerequisites.every(prereqId => 
          updatedTechState.completedFocuses.includes(prereqId)
        );
      }
      return true;
    });

    if (availableFocuses.length > 0) {
      // Escolhe o primeiro foco disponível
      const selectedFocus = availableFocuses[0];
      updatedTechState = {
        ...updatedTechState,
        activeFocusId: selectedFocus.id,
      };

      logs.push({
        actionType: 'focus',
        message: `Selecionou o Foco Nacional: ${selectedFocus.title}`,
      });
    }
  }

  // -------------------------------------------------------------
  // 2. PESQUISA TECNOLÓGICA
  // -------------------------------------------------------------
  if (!updatedTechState.activeResearchId) {
    // Busca tecnologias disponíveis (não pesquisadas e com pré-requisitos atendidos)
    const availableTechs = TECHNOLOGIES.filter(tech => {
      if (tech.researched) return false;
      if (updatedTechState.completedTechnologies.includes(tech.id)) return false;
      
      // Verifica pré-requisitos
      if (tech.prerequisites && tech.prerequisites.length > 0) {
        return tech.prerequisites.every(prereqId => 
          updatedTechState.completedTechnologies.includes(prereqId)
        );
      }
      return true;
    });

    // Escolhe uma tecnologia que possa pagar
    const affordableTech = availableTechs.find(t => updatedCountry.resources.gold >= t.costGold);
    
    if (affordableTech) {
      updatedCountry = {
        ...updatedCountry,
        resources: {
          ...updatedCountry.resources,
          gold: updatedCountry.resources.gold - affordableTech.costGold,
        },
      };

      updatedTechState = {
        ...updatedTechState,
        activeResearchId: affordableTech.id,
      };

      logs.push({
        actionType: 'tech',
        message: `Iniciou a pesquisa tecnológica: ${affordableTech.title} (💰 ${affordableTech.costGold})`,
      });
    }
  }

  // -------------------------------------------------------------
  // 3. CONSTRUÇÃO EM PROVÍNCIAS
  // -------------------------------------------------------------
  // Limite de segurança: mantém pelo menos 300 de ouro
  if (updatedCountry.resources.gold >= 300) {
    // Busca províncias pertencentes a este país
    const aiProvinces = provinces.filter(p => p.owner === country.tag);
    
    if (aiProvinces.length > 0) {
      // Pega uma província aleatória
      const targetProvince = aiProvinces[Math.floor(Math.random() * aiProvinces.length)];
      
      // Verifica se já há construção em andamento nesta província
      const hasConstruction = updatedConstructions.some(c => c.provinceId === targetProvince.id);
      
      if (!hasConstruction) {
        // Lista de edifícios possíveis
        const buildingTypes = Object.keys(BUILDING_DEFINITIONS) as BuildingType[];
        const chosenBuilding = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
        const def = BUILDING_DEFINITIONS[chosenBuilding];
        
        // Verifica nível atual do edifício
        const existingBuilding = targetProvince.buildings.find(b => b.type === chosenBuilding);
        const currentLevel = existingBuilding?.level ?? 0;
        
        // Verifica se pode construir (nível máximo não atingido)
        if (currentLevel < def.maxLevel) {
          const buildingCost = getBuildingCost(chosenBuilding, currentLevel);
          const buildTime = getBuildingTime(chosenBuilding, currentLevel);
          
          if (updatedCountry.resources.gold >= buildingCost) {
            updatedCountry = {
              ...updatedCountry,
              resources: {
                ...updatedCountry.resources,
                gold: updatedCountry.resources.gold - buildingCost,
              },
            };

            const newConstruction: BuildingConstruction = {
              id: `const_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              provinceId: targetProvince.id,
              buildingType: chosenBuilding,
              daysRemaining: buildTime,
              totalDays: buildTime,
              cost: buildingCost,
            };

            updatedConstructions = [...updatedConstructions, newConstruction];

            const translatedName = getBuildingName(chosenBuilding);
            logs.push({
              actionType: 'building',
              message: `Iniciou obra de ${translatedName} em ${targetProvince.name} (💰 ${buildingCost})`,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. RECRUTAMENTO DE TROPAS MILITARES
  // -------------------------------------------------------------
  // Se ainda tiver ouro (ex: mais de 250) e reserva de manpower
  if (updatedCountry.resources.gold >= 250 && updatedCountry.resources.manpower >= 1000) {
    const aiProvinces = provinces.filter(p => p.owner === country.tag);
    
    if (aiProvinces.length > 0) {
      const targetProvince = aiProvinces[Math.floor(Math.random() * aiProvinces.length)];
      
      // Lista de tipos de unidades
      const unitTypes = Object.keys(UNIT_DEFINITIONS) as UnitType[];
      const chosenUnit = unitTypes[Math.floor(Math.random() * unitTypes.length)];
      const def = UNIT_DEFINITIONS[chosenUnit];
      
      if (updatedCountry.resources.gold >= def.cost && updatedCountry.resources.manpower >= def.manpowerCost) {
        updatedCountry = {
          ...updatedCountry,
          resources: {
            ...updatedCountry.resources,
            gold: updatedCountry.resources.gold - def.cost,
            manpower: updatedCountry.resources.manpower - def.manpowerCost,
          },
        };

        // Verifica se já existe recrutamento idêntico
        const existingRecruitment = updatedRecruitments.find(
          r => r.owner === country.tag &&
               r.provinceId === targetProvince.id &&
               r.unitType === chosenUnit &&
               r.daysRemaining === def.trainingTime
        );

        if (existingRecruitment) {
          // Incrementa quantidade
          updatedRecruitments = updatedRecruitments.map(r =>
            r.id === existingRecruitment.id ? { ...r, count: r.count + 1 } : r
          );
        } else {
          // Cria novo recrutamento
          const newRecruitment: Recruitment = {
            id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            provinceId: targetProvince.id,
            owner: country.tag,
            unitType: chosenUnit,
            daysRemaining: def.trainingTime,
            count: 1,
          };
          updatedRecruitments = [...updatedRecruitments, newRecruitment];
        }

        const translatedUnit = getUnitName(chosenUnit);
        logs.push({
          actionType: 'military',
          message: `Iniciou treinamento de ${translatedUnit} em ${targetProvince.name} (💰 ${def.cost})`,
        });
      }
    }
  }

  return {
    techState: updatedTechState,
    buildingConstructions: updatedConstructions,
    recruitments: updatedRecruitments,
    country: updatedCountry,
    logs,
  };
}
