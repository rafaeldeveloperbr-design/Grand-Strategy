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
            path: [],
            targetArmyId: null
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

  // 4. Movimentação de Exércitos - State Machine com Target Locking
  const myArmies = updatedArmies.filter(a => a.owner === country.tag && !a.destination);
  
  for (const army of myArmies) {
    // Validação defensiva rigorosa
    if (!army || !army.id || !army.location) {
      console.warn('AI: Exército inválido detectado, pulando:', army);
      continue;
    }
    
    const currentProvince = updatedProvinces.find(p => p.id === army.location);
    if (!currentProvince) {
      console.warn(`AI: Província ${army.location} não encontrada para exército ${army.id}`);
      continue;
    }
    
    // Limpeza de alvos inválidos (Dead Target Cleanup)
    if (army.targetArmyId) {
      const targetArmy = updatedArmies.find(a => a.id === army.targetArmyId);
      if (!targetArmy) {
        console.log(`AI: Alvo ${army.targetArmyId} não existe mais, limpando target lock de ${army.id}`);
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id ? { ...a, targetArmyId: null } : a
        );
      }
    }
    
    // Verificação defensiva: garante que o exército ainda existe no array atualizado
    const currentArmy = updatedArmies.find(a => a.id === army.id);
    if (!currentArmy) {
      console.warn(`AI: Exército ${army.id} não existe mais no array, pulando`);
      continue;
    }
    
    // Verifica se está em guerra
    const atWarWith = updatedWars.filter(
      w => (w.attacker === country.tag || w.defender === country.tag)
    );
    
    if (atWarWith.length === 0) continue; // Não está em guerra, não toma ações militares
    
    const war = atWarWith[0];
    const enemy = war.attacker === country.tag ? war.defender : war.attacker;
    
    // === TARGET LOCKING: Verifica se já tem um alvo travado ===
    let targetArmy: Army | null = null;
    if (army.targetArmyId) {
      targetArmy = updatedArmies.find(a => a.id === army.targetArmyId) || null;
      
      // Se o alvo foi eliminado ou não existe mais, limpa o target
      if (!targetArmy || targetArmy.owner === country.tag) {
        console.log('AI DECISION:', army.id, 'TARGET LOST - Alvo eliminado ou inexistente');
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id ? { ...a, targetArmyId: null } : a
        );
        targetArmy = null;
      }
    }
    
    // === STATE MACHINE: 3 Prioridades Hierárquicas com Target Locking ===
    
    // PRIORIDADE 1: Defesa de Pátria (com Target Locking)
    const enemyArmiesInTerritory = updatedArmies.filter(a => {
      if (a.owner !== enemy) return false;
      const armyProvince = updatedProvinces.find(p => p.id === a.location);
      return armyProvince && armyProvince.owner === country.tag;
    });
    
    if (enemyArmiesInTerritory.length > 0) {
      // Se já tem alvo travado E o alvo está em território nacional, mantém o lock
      if (targetArmy && enemyArmiesInTerritory.some(a => a.id === targetArmy?.id)) {
        console.log('AI DECISION:', army.id, `DEFENDER (LOCKED) - Mantendo alvo: ${targetArmy.id}`);
      } else {
        // Novo alvo - trava no exército inimigo mais próximo
        let closestEnemy = enemyArmiesInTerritory[0];
        let minDistance = Infinity;
        
        for (const enemyArmy of enemyArmiesInTerritory) {
          // Validação defensiva antes de calcular distância
          if (!army.location || !enemyArmy.location) {
            console.warn('AI: Localização inválida ao calcular distância');
            continue;
          }
          
          const distance = calculateDistance(army.location, enemyArmy.location, updatedProvinces);
          if (distance < minDistance) {
            minDistance = distance;
            closestEnemy = enemyArmy;
          }
        }
        
        targetArmy = closestEnemy;
        console.log('AI DECISION:', army.id, `DEFENDER (NEW LOCK) - Novo alvo: ${targetArmy.id}`);
        
        // Salva o target lock
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id ? { ...a, targetArmyId: targetArmy!.id } : a
        );
      }
      
      // Move em direção ao alvo travado
      if (targetArmy && targetArmy.location !== army.location) {
        // Validação defensiva
        if (!army.location || !targetArmy.location) {
          console.warn('AI: Localização inválida ao mover em direção ao alvo');
        } else {
          const nextStep = findPathTowards(army.location, targetArmy.location, updatedProvinces);
          if (nextStep) {
            updatedArmies = updatedArmies.map(a => 
              a.id === army.id
                ? { ...a, destination: nextStep, movementProgress: 0, path: [] }
                : a
            );
          }
        }
      }
      continue;
    }
    
    // PRIORIDADE 2: Intercepção e Combate (com Target Locking)
    const enemyInNeighbor = currentProvince.neighbors.find(nId => {
      const neighbor = updatedProvinces.find(p => p.id === nId);
      if (!neighbor || neighbor.owner !== enemy) return false;
      return updatedArmies.some(a => a.owner === enemy && a.location === nId);
    });
    
    if (enemyInNeighbor) {
      const myStrength = calculateArmySize(army);
      const enemyArmy = updatedArmies.find(a => a.owner === enemy && a.location === enemyInNeighbor);
      const enemyStrength = enemyArmy ? calculateArmySize(enemyArmy) : 0;
      const forceRatio = myStrength / Math.max(1, enemyStrength);
      
      // Se já tem alvo travado E o alvo está na província vizinha, mantém o lock
      if (targetArmy && targetArmy.location === enemyInNeighbor) {
        console.log('AI DECISION:', army.id, `INTERCEPTAR (LOCKED) - Mantendo alvo: ${targetArmy.id}`);
      } else if (forceRatio >= 0.8) {
        // Novo alvo - trava no exército inimigo vizinho
        targetArmy = enemyArmy!;
        console.log('AI DECISION:', army.id, `INTERCEPTAR (NEW LOCK) - Ratio: ${forceRatio.toFixed(2)}, Alvo: ${targetArmy.id}`);
        
        // Salva o target lock
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id ? { ...a, targetArmyId: targetArmy!.id } : a
        );
      }
      
      // Ataca se ratio >= 0.8 OU se já tem target lock
      if (forceRatio >= 0.8 || (targetArmy && targetArmy.location === enemyInNeighbor)) {
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id
            ? { ...a, destination: enemyInNeighbor, movementProgress: 0, path: [] }
            : a
        );
        continue;
      }
    }
    
    // PRIORIDADE 3: Concentração de Forças (SEM fuga aleatória)
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
          // Validação defensiva
          if (!army.location || !friendlyArmy.location) {
            console.warn('AI: Localização inválida ao calcular distância para aliado');
            continue;
          }
          
          const distance = calculateDistance(army.location, friendlyArmy.location, updatedProvinces);
          if (distance < minDistance) {
            minDistance = distance;
            closestFriendly = friendlyArmy;
          }
        }
        
        // Move em direção ao exército aliado mais próximo
        if (!army.location || !closestFriendly.location) {
          console.warn('AI: Localização inválida ao mover em direção ao aliado');
        } else {
          const nextStep = findPathTowards(army.location, closestFriendly.location, updatedProvinces);
          if (nextStep) {
            updatedArmies = updatedArmies.map(a => 
              a.id === army.id
                ? { ...a, destination: nextStep, movementProgress: 0, path: [] }
                : a
            );
          }
        }
      } else {
        // NÃO HÁ ALIADOS PRÓXIMOS - MANTÉM POSIÇÃO (SEM FUGA ALEATÓRIA)
        console.log('AI DECISION:', army.id, 'STAY/DEFEND - Sem aliados próximos, mantendo posição defensiva');
        // Não faz nada - mantém a posição atual
      }
      continue;
    }
    
    // ENGAJAMENTO FORÇADO: Se está adjacente ao jogador e sem rota de fuga
    const playerArmies = updatedArmies.filter(a => a.owner === enemy);
    const adjacentPlayerArmy = playerArmies.find(pa => {
      if (!pa.location) return false;
      return currentProvince.neighbors.includes(pa.location);
    });
    
    if (adjacentPlayerArmy) {
      // Verifica se tem rota de fuga segura (província própria ou vazia)
      const hasEscapeRoute = currentProvince.neighbors.some(nId => {
        const neighbor = updatedProvinces.find(p => p.id === nId);
        if (!neighbor) return false;
        // Rota segura se for território próprio ou neutro (não inimigo)
        return neighbor.owner === country.tag || neighbor.owner !== enemy;
      });
      
      if (!hasEscapeRoute) {
        // ENCURRALADO - Força engajamento
        console.log('AI DECISION:', army.id, 'FORCED ENGAGE - Encurralado, forçando combate');
        
        const enemyNeighbor = currentProvince.neighbors.find(nId => {
          const neighbor = updatedProvinces.find(p => p.id === nId);
          return neighbor && neighbor.owner === enemy;
        });
        
        if (enemyNeighbor) {
          // Validação defensiva: verifica se o exército ainda existe
          const armyExists = updatedArmies.some(a => a.id === army.id);
          if (!armyExists) {
            console.warn(`AI: Exército ${army.id} não existe mais, pulando movimentação`);
            continue;
          }
          
          updatedArmies = updatedArmies.map(a => 
            a.id === army.id
              ? { ...a, destination: enemyNeighbor, movementProgress: 0, path: [] }
              : a
          );
        }
        continue;
      }
    }
    
    // RESTRIÇÃO DE INVASÃO CEGA
    const MIN_ARMY_SIZE_FOR_INVASION = 3000;
    if (myStrength < MIN_ARMY_SIZE_FOR_INVASION) {
      console.log('AI DECISION:', army.id, 'AGUARDAR - Exército muito pequeno para invadir');
      continue;
    }
    
    // Se chegou aqui, pode invadir território inimigo
    console.log('AI DECISION:', army.id, 'INVADIR - Sem ameaças e tamanho adequado');
    
    const enemyNeighbor = currentProvince.neighbors.find(nId => {
      const neighbor = updatedProvinces.find(p => p.id === nId);
      return neighbor && neighbor.owner === enemy;
    });
    
    if (enemyNeighbor) {
      // Validação defensiva: verifica se o exército ainda existe
      const armyExists = updatedArmies.some(a => a.id === army.id);
      if (!armyExists) {
        console.warn(`AI: Exército ${army.id} não existe mais, pulando invasão`);
      } else {
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id
            ? { ...a, destination: enemyNeighbor, movementProgress: 0, path: [] }
            : a
        );
      }
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
  // Validação defensiva
  if (!fromId || !toId) {
    console.warn('calculateDistance: IDs inválidos:', { fromId, toId });
    return Infinity;
  }
  
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
  // Validação defensiva
  if (!fromId || !toId) {
    console.warn('findPathTowards: IDs inválidos:', { fromId, toId });
    return null;
  }
  
  if (fromId === toId) return null;
  
  const fromProvince = provinces.find(p => p.id === fromId);
  if (!fromProvince) {
    console.warn(`findPathTowards: Província de origem ${fromId} não encontrada`);
    return null;
  }
  
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
