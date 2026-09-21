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

  // 4. Movimentação de Exércitos - Defender ou atacar
  const myArmies = updatedArmies.filter(a => a.owner === country.tag && !a.destination);
  
  for (const army of myArmies) {
    if (!army.location) continue;
    
    // Verifica se está em guerra
    const atWarWith = updatedWars.filter(
      w => (w.attacker === country.tag || w.defender === country.tag)
    );
    
    if (atWarWith.length > 0) {
      // Está em guerra - move para atacar ou defender
      const war = atWarWith[0];
      const enemy = war.attacker === country.tag ? war.defender : war.attacker;
      
      // Encontra província inimiga vizinha
      const currentProvince = updatedProvinces.find(p => p.id === army.location);
      if (!currentProvince) continue;
      
      const enemyNeighbor = currentProvince.neighbors.find(nId => {
        const neighbor = updatedProvinces.find(p => p.id === nId);
        return neighbor && neighbor.owner === enemy;
      });
      
      if (enemyNeighbor) {
        // Ataca província inimiga
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
