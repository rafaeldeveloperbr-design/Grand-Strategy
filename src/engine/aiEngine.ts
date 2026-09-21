/**
 * ============================================================
 * MÓDULO 4 - Motor de IA
 * ============================================================
 * Controla países não-jogadores (bots)
 */

import { Country, Province, Army } from '../types';
import { DiplomaticRelation, War } from '../types/diplomacy';
import { UNIT_DEFINITIONS } from '../data/units';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { 
  declareWar, 
  improveRelations, 
  areAtWar,
  getOrCreateRelation,
  canMakePeace
} from './diplomacy';
import { calculateArmySize } from './combat';

/**
 * Configuração de personalidade de IA
 */
export interface AIPersonality {
  /** Quão agressivo é o país (0-1) */
  aggressiveness: number;
  /** Quão expansionista é (0-1) */
  expansionism: number;
  /** Quão pacífico é (0-1) */
  peacefulness: number;
  /** Prioridade de construção (0-1) */
  builderPriority: number;
}

/**
 * Personalidades padrão para cada país
 */
export const AI_PERSONALITIES: Record<string, AIPersonality> = {
  IMP: { aggressiveness: 0.6, expansionism: 0.7, peacefulness: 0.3, builderPriority: 0.5 },
  REP: { aggressiveness: 0.4, expansionism: 0.5, peacefulness: 0.5, builderPriority: 0.6 },
  RNO: { aggressiveness: 0.3, expansionism: 0.4, peacefulness: 0.7, builderPriority: 0.7 },
  KHA: { aggressiveness: 0.8, expansionism: 0.9, peacefulness: 0.1, builderPriority: 0.3 },
  THC: { aggressiveness: 0.5, expansionism: 0.4, peacefulness: 0.6, builderPriority: 0.6 },
  LIG: { aggressiveness: 0.3, expansionism: 0.3, peacefulness: 0.8, builderPriority: 0.8 }
};

/**
 * Processa tick de IA para um país
 */
export function processAITick(
  country: Country,
  provinces: Province[],
  armies: Army[],
  relations: DiplomaticRelation[],
  wars: War[],
  allCountries: Country[],
  currentDate: { year: number; month: number; day: number }
): {
  armies: Army[];
  relations: DiplomaticRelation[];
  wars: War[];
  country: Country;
  provinces: Province[];
  log?: string;
} {
  const personality = AI_PERSONALITIES[country.tag] || {
    aggressiveness: 0.5,
    expansionism: 0.5,
    peacefulness: 0.5,
    builderPriority: 0.5
  };

  let updatedArmies = [...armies];
  let updatedRelations = [...relations];
  let updatedWars = [...wars];
  let updatedCountry = { ...country };
  let updatedProvinces = [...provinces];
  let log: string | undefined;

  // 1. Gestão Econômica - Construir edifícios
  if (Math.random() < personality.builderPriority && updatedCountry.resources.gold > 200) {
    const ownedProvinces = updatedProvinces.filter(p => p.owner === country.tag);
    if (ownedProvinces.length > 0) {
      const targetProvince = ownedProvinces[Math.floor(Math.random() * ownedProvinces.length)];
      
      // Tenta construir algo
      const buildingTypes = Object.keys(BUILDING_DEFINITIONS) as Array<keyof typeof BUILDING_DEFINITIONS>;
      const availableBuildings = buildingTypes.filter(type => {
        const existing = targetProvince.buildings.find(b => b.type === type);
        const level = existing?.level || 0;
        const def = BUILDING_DEFINITIONS[type];
        return level < def.maxLevel && updatedCountry.resources.gold >= def.baseCost;
      });

      if (availableBuildings.length > 0) {
        const buildingType = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];
        const def = BUILDING_DEFINITIONS[buildingType];
        
        updatedCountry.resources.gold -= def.baseCost;
        updatedProvinces = updatedProvinces.map(p => {
          if (p.id === targetProvince.id) {
            const existing = p.buildings.find(b => b.type === buildingType);
            if (existing) {
              return {
                ...p,
                buildings: p.buildings.map(b => 
                  b.type === buildingType 
                    ? { ...b, level: b.level + 1, daysRemaining: def.baseBuildTime }
                    : b
                )
              };
            } else {
              return {
                ...p,
                buildings: [...p.buildings, {
                  type: buildingType,
                  level: 1,
                  daysRemaining: def.baseBuildTime
                }]
              };
            }
          }
          return p;
        });
        log = `🏗️ ${country.name} construiu ${def.name} em ${targetProvince.name}`;
      }
    }
  }

  // 2. Gestão Militar - Recrutar tropas
  if (updatedCountry.resources.gold > 100 && updatedCountry.resources.manpower > 1000) {
    const ownedProvinces = updatedProvinces.filter(p => p.owner === country.tag);
    const armiesInCountry = updatedArmies.filter(a => a.owner === country.tag);
    
    // Recruta se tem poucas tropas
    if (armiesInCountry.length < 3 || calculateArmySize(armiesInCountry[0]) < 3000) {
      const unitTypes = Object.keys(UNIT_DEFINITIONS) as Array<keyof typeof UNIT_DEFINITIONS>;
      const unitType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
      const def = UNIT_DEFINITIONS[unitType];
      
      if (updatedCountry.resources.gold >= def.cost && updatedCountry.resources.manpower >= def.manpowerCost) {
        updatedCountry.resources.gold -= def.cost;
        updatedCountry.resources.manpower -= def.manpowerCost;
        
        // Adiciona regimento ao exército existente ou cria novo
        const targetProvince = ownedProvinces[Math.floor(Math.random() * ownedProvinces.length)];
        const existingArmy = updatedArmies.find(
          a => a.owner === country.tag && a.location === targetProvince.id
        );
        
        if (existingArmy) {
          updatedArmies = updatedArmies.map(a => 
            a.id === existingArmy.id
              ? { ...a, regiments: [...a.regiments, { type: unitType, strength: 1000, morale: 100 }] }
              : a
          );
        } else {
          updatedArmies.push({
            id: `army_${country.tag}_${Date.now()}`,
            owner: country.tag,
            name: `${country.name} Army`,
            regiments: [{ type: unitType, strength: 1000, morale: 100 }],
            location: targetProvince.id,
            destination: null,
            movementProgress: 0,
            movementSpeed: def.mobility,
            position: null,
            path: []
          });
        }
        log = `🗡️ ${country.name} recrutou ${def.name}`;
      }
    }
  }

  // 3. Tomada de Decisão - Declarar guerra ou melhorar relações
  if (Math.random() < 0.01) { // 1% de chance por tick
    const neighbors = getNeighborCountries(country.tag, updatedProvinces, allCountries);
    
    for (const neighborTag of neighbors) {
      if (neighborTag === 'IMP') continue; // Não ataca o jogador (para debug)
      
      const relation = getOrCreateRelation(updatedRelations, country.tag, neighborTag);
      const neighborCountry = allCountries.find(c => c.tag === neighborTag);
      if (!neighborCountry) continue;
      
      // Verifica se já está em guerra
      if (areAtWar(updatedRelations, country.tag, neighborTag)) {
        // Está em guerra - verifica se pode fazer paz (mínimo 30 dias)
        const war = updatedWars.find(
          w => (w.attacker === country.tag && w.defender === neighborTag) ||
               (w.defender === country.tag && w.attacker === neighborTag)
        );
        
        if (war && canMakePeace(war, currentDate)) {
          // Pode considerar fazer paz se estiver perdendo
          if (war.warScore < -30 && personality.peacefulness > 0.5) {
            // IA poderia fazer paz aqui, mas deixamos apenas para o jogador
            // Por enquanto, apenas continua lutando
          }
        }
        continue; // Não toma outras ações diplomáticas durante guerra
      }
      
      // Avalia se deve declarar guerra
      const myArmies = updatedArmies.filter(a => a.owner === country.tag);
      const myStrength = myArmies.reduce((sum, a) => sum + calculateArmySize(a), 0);
      
      const neighborArmies = updatedArmies.filter(a => a.owner === neighborTag);
      const neighborStrength = neighborArmies.reduce((sum, a) => sum + calculateArmySize(a), 0);
      
      const strengthRatio = myStrength / Math.max(1, neighborStrength);
      
      // Decide baseado na personalidade
      if (personality.aggressiveness > 0.6 && strengthRatio > 1.3 && relation.opinion < 0) {
        // Declara guerra
        const result = declareWar(updatedRelations, updatedWars, country.tag, neighborTag, currentDate);
        updatedRelations = result.relations;
        updatedWars = result.wars;
        log = `⚔️ ${country.name} declarou guerra a ${neighborCountry.name}!`;
        break;
      } else if (personality.peacefulness > 0.5 && relation.opinion > -20) {
        // Melhora relações
        updatedRelations = improveRelations(updatedRelations, country.tag, neighborTag, 5);
        log = `🤝 ${country.name} melhorou relações com ${neighborCountry.name}`;
        break;
      }
    }
  }

  // 4. Movimentação de Exércitos - State Machine com 3 Prioridades
  const myArmies = updatedArmies.filter(a => a.owner === country.tag && !a.destination);
  
  for (const army of myArmies) {
    if (!army.location) continue;
    
    const currentProvince = updatedProvinces.find(p => p.id === army.location);
    if (!currentProvince) continue;
    
    // Verifica se está em guerra
    const atWarWith = updatedWars.filter(
      w => (w.attacker === country.tag || w.defender === country.tag)
    );
    
    if (atWarWith.length === 0) continue; // Não está em guerra, não toma ações militares
    
    const war = atWarWith[0];
    const enemy = war.attacker === country.tag ? war.defender : war.attacker;
    
    // === STATE MACHINE: 3 Prioridades Hierárquicas ===
    
    // PRIORIDADE 1: Defesa de Pátria
    // Verifica se há exércitos inimigos em território nacional
    const enemyArmiesInTerritory = updatedArmies.filter(a => {
      if (a.owner !== enemy) return false;
      const armyProvince = updatedProvinces.find(p => p.id === a.location);
      return armyProvince && armyProvince.owner === country.tag;
    });
    
    if (enemyArmiesInTerritory.length > 0) {
      console.log('AI DECISION:', army.id, 'DEFENDER - Exércitos inimigos em território nacional');
      
      // Encontra o exército inimigo mais próximo
      let closestEnemy = enemyArmiesInTerritory[0];
      let minDistance = Infinity;
      
      for (const enemyArmy of enemyArmiesInTerritory) {
        const enemyProvince = updatedProvinces.find(p => p.id === enemyArmy.location);
        if (!enemyProvince) continue;
        
        // Calcula distância simples (número de províncias)
        const distance = calculateDistance(army.location!, enemyArmy.location!, updatedProvinces);
        if (distance < minDistance) {
          minDistance = distance;
          closestEnemy = enemyArmy;
        }
      }
      
      // Move para interceptar o exército inimigo mais próximo
      const targetProvince = updatedProvinces.find(p => p.id === closestEnemy.location);
      if (targetProvince && targetProvince.id !== army.location) {
        // Encontra o vizinho mais próximo do alvo
        const nextStep = findPathTowards(army.location!, targetProvince.id, updatedProvinces);
        if (nextStep) {
          updatedArmies = updatedArmies.map(a => 
            a.id === army.id
              ? { ...a, destination: nextStep, movementProgress: 0, path: [] }
              : a
          );
        }
      }
      continue; // Prioridade 1 resolvida, próximo exército
    }
    
    // PRIORIDADE 2: Intercepção e Combate
    // Verifica se há exército inimigo em província vizinha
    const enemyInNeighbor = currentProvince.neighbors.find(nId => {
      const neighbor = updatedProvinces.find(p => p.id === nId);
      if (!neighbor || neighbor.owner !== enemy) return false;
      
      // Verifica se há exército inimigo nesta província vizinha
      return updatedArmies.some(a => a.owner === enemy && a.location === nId);
    });
    
    if (enemyInNeighbor) {
      // Calcula ratio de força
      const myStrength = calculateArmySize(army);
      const enemyArmy = updatedArmies.find(a => a.owner === enemy && a.location === enemyInNeighbor);
      const enemyStrength = enemyArmy ? calculateArmySize(enemyArmy) : 0;
      const forceRatio = myStrength / Math.max(1, enemyStrength);
      
      console.log('AI DECISION:', army.id, `INTERCEPTAR - Ratio: ${forceRatio.toFixed(2)}`);
      
      // Se ratio >= 0.8, ataca
      if (forceRatio >= 0.8) {
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id
            ? { ...a, destination: enemyInNeighbor, movementProgress: 0, path: [] }
            : a
        );
        continue; // Prioridade 2 resolvida, próximo exército
      }
    }
    
    // PRIORIDADE 3: Concentração de Forças
    // Se ratio < 0.6, busca exército aliado para fundir
    const myStrength = calculateArmySize(army);
    const allEnemyArmies = updatedArmies.filter(a => a.owner === enemy);
    const totalEnemyStrength = allEnemyArmies.reduce((sum, a) => sum + calculateArmySize(a), 0);
    const overallRatio = myStrength / Math.max(1, totalEnemyStrength);
    
    if (overallRatio < 0.6) {
      console.log('AI DECISION:', army.id, `FUNDIR - Ratio muito baixo: ${overallRatio.toFixed(2)}`);
      
      // Encontra exército aliado mais próximo
      const friendlyArmies = updatedArmies.filter(a => 
        a.owner === country.tag && 
        a.id !== army.id && 
        !a.destination &&
        a.location !== army.location
      );
      
      if (friendlyArmies.length > 0) {
        let closestFriendly = friendlyArmies[0];
        let minDistance = Infinity;
        
        for (const friendlyArmy of friendlyArmies) {
          const distance = calculateDistance(army.location!, friendlyArmy.location!, updatedProvinces);
          if (distance < minDistance) {
            minDistance = distance;
            closestFriendly = friendlyArmy;
          }
        }
        
        // Move em direção ao exército aliado mais próximo
        const nextStep = findPathTowards(army.location!, closestFriendly.location!, updatedProvinces);
        if (nextStep) {
          updatedArmies = updatedArmies.map(a => 
            a.id === army.id
              ? { ...a, destination: nextStep, movementProgress: 0, path: [] }
              : a
          );
        }
      }
      continue; // Prioridade 3 resolvida, próximo exército
    }
    
    // RESTRIÇÃO DE INVASÃO CEGA
    // Só invade se não houver ameaças e tiver tamanho mínimo sustentável
    const MIN_ARMY_SIZE_FOR_INVASION = 3000;
    if (myStrength < MIN_ARMY_SIZE_FOR_INVASION) {
      console.log('AI DECISION:', army.id, 'AGUARDAR - Exército muito pequeno para invadir');
      continue; // Exército muito pequeno, não invade
    }
    
    // Se chegou aqui, pode invadir território inimigo
    console.log('AI DECISION:', army.id, 'INVADIR - Sem ameaças e tamanho adequado');
    
    const enemyNeighbor = currentProvince.neighbors.find(nId => {
      const neighbor = updatedProvinces.find(p => p.id === nId);
      return neighbor && neighbor.owner === enemy;
    });
    
    if (enemyNeighbor) {
      updatedArmies = updatedArmies.map(a => 
        a.id === army.id
          ? { ...a, destination: enemyNeighbor, movementProgress: 0, path: [] }
          : a
      );
    }
  }

  return {
    armies: updatedArmies,
    relations: updatedRelations,
    wars: updatedWars,
    country: updatedCountry,
    provinces: updatedProvinces,
    log
  };
}

/**
 * Obtém países vizinhos (que compartilham fronteira)
 */
function getNeighborCountries(
  countryTag: string,
  provinces: Province[],
  allCountries: Country[]
): string[] {
  const ownedProvinces = provinces.filter(p => p.owner === countryTag);
  const neighborIds = new Set<string>();
  
  for (const province of ownedProvinces) {
    for (const neighborId of province.neighbors) {
      neighborIds.add(neighborId);
    }
  }
  
  const neighborCountries = new Set<string>();
  for (const neighborId of neighborIds) {
    const neighborProvince = provinces.find(p => p.id === neighborId);
    if (neighborProvince && neighborProvince.owner !== countryTag) {
      neighborCountries.add(neighborProvince.owner);
    }
  }
  
  return Array.from(neighborCountries);
}

/**
 * Calcula distância entre duas províncias (número de províncias no caminho)
 * Usa BFS simples para encontrar o caminho mais curto
 */
function calculateDistance(
  fromId: string,
  toId: string,
  provinces: Province[]
): number {
  if (fromId === toId) return 0;
  
  const visited = new Set<string>();
  const queue: Array<{ id: string; distance: number }> = [{ id: fromId, distance: 0 }];
  visited.add(fromId);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.id === toId) {
      return current.distance;
    }
    
    const province = provinces.find(p => p.id === current.id);
    if (!province) continue;
    
    for (const neighborId of province.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, distance: current.distance + 1 });
      }
    }
  }
  
  return Infinity; // Caminho não encontrado
}

/**
 * Encontra o próximo passo no caminho em direção a um destino
 * Retorna o ID da província vizinha que leva ao destino
 */
function findPathTowards(
  fromId: string,
  toId: string,
  provinces: Province[]
): string | null {
  if (fromId === toId) return null;
  
  const fromProvince = provinces.find(p => p.id === fromId);
  if (!fromProvince) return null;
  
  // Para cada vizinho, calcula distância até o destino
  let bestNeighbor: string | null = null;
  let minDistance = Infinity;
  
  for (const neighborId of fromProvince.neighbors) {
    const distance = calculateDistance(neighborId, toId, provinces);
    if (distance < minDistance) {
      minDistance = distance;
      bestNeighbor = neighborId;
    }
  }
  
  return bestNeighbor;
}
