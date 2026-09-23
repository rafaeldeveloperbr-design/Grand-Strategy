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
 * Cooldown de recrutamento em dias (1 mês = 30 dias)
 */
const RECRUITMENT_COOLDOWN_DAYS = 30;

/**
 * Rastreia o último dia de recrutamento de cada país
 */
const lastRecruitmentDay = new Map<string, number>();

/**
 * Converte data para dias totais (para comparação)
 */
function dateToDays(date: { year: number; month: number; day: number }): number {
  return date.year * 360 + date.month * 30 + date.day;
}

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
  // === GUARD CLAUSE: Validação rigorosa de entrada ===
  let log: string | undefined;
  
  if (!country || !country.tag) {
    console.error('AI: country inválido recebido');
    return { armies, relations, wars, country, provinces, log };
  }
  
  if (!Array.isArray(armies)) {
    console.error('AI: armies não é um array');
    return { armies: [], relations, wars, country, provinces, log };
  }
  
  if (!Array.isArray(provinces)) {
    console.error('AI: provinces não é um array');
    return { armies, relations, wars, country, provinces: [], log };
  }

  // Filtra exércitos inválidos imediatamente
  const validArmies = armies.filter(army => 
    army && 
    typeof army === 'object' && 
    army.id && 
    army.owner && 
    army.location
  );

  // Filtra províncias inválidas imediatamente
  const validProvinces = provinces.filter(province =>
    province &&
    typeof province === 'object' &&
    province.id &&
    province.owner
  );

  const personality = AI_PERSONALITIES[country.tag] || {
    aggressiveness: 0.5,
    expansionism: 0.5,
    peacefulness: 0.5,
    builderPriority: 0.5
  };

  let updatedArmies = [...validArmies];
  let updatedRelations = [...relations];
  let updatedWars = [...wars];
  let updatedCountry = { ...country };
  let updatedProvinces = [...validProvinces];

  // 1. Gestão Econômica - Construir edifícios
  if (Math.random() < personality.builderPriority && updatedCountry.resources.gold > 200) {
    const ownedProvinces = updatedProvinces.filter(p => p && p.id && p.owner === country.tag);
    if (ownedProvinces.length > 0) {
      const targetProvince = ownedProvinces[Math.floor(Math.random() * ownedProvinces.length)];
      
      // Guard clause: verifica se targetProvince é válido
      if (!targetProvince || !targetProvince.id) {
        console.warn('AI: targetProvince inválido, pulando construção');
        return {
          armies: updatedArmies,
          relations: updatedRelations,
          wars: updatedWars,
          country: updatedCountry,
          provinces: updatedProvinces,
          log
        };
      }
      
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
          // Guard clause: verifica se p é válido antes de acessar propriedades
          if (!p || !p.id) return p;
          
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

  // 2. Gestão Militar - Recrutar tropas (COM COOLDOWN)
  const armiesInCountry = updatedArmies.filter(a => a && a.id && a.owner === country.tag);
  const totalTroops = armiesInCountry.reduce((sum, a) => sum + calculateArmySize(a), 0);
  
  // CORREÇÃO: Verifica cooldown de recrutamento
  const currentDay = dateToDays(currentDate);
  const lastRecruitDay = lastRecruitmentDay.get(country.tag) || 0;
  const daysSinceLastRecruit = currentDay - lastRecruitDay;
  const canRecruit = daysSinceLastRecruit >= RECRUITMENT_COOLDOWN_DAYS;
  
  if (!canRecruit) {
    // Ainda em cooldown, pula recrutamento
  } else {
    // RECRUTAMENTO DE EMERGÊNCIA: Se tem < 2000 tropas e tem recursos, recrutar automaticamente
    const isEmergencyRecruitment = totalTroops < 2000 && updatedCountry.resources.gold >= 50 && updatedCountry.resources.manpower >= 500;
    const isNormalRecruitment = updatedCountry.resources.gold >= 100 && updatedCountry.resources.manpower >= 1000;
    
    if (isEmergencyRecruitment || isNormalRecruitment) {
      const ownedProvinces = updatedProvinces.filter(p => p && p.id && p.owner === country.tag);
      
      // Guard clause: verifica se há províncias válidas
      if (ownedProvinces.length === 0) {
        console.warn(`AI: ${country.tag} não possui províncias válidas para recrutar`);
      } else {
        // Recruta se tem poucas tropas OU é recrutamento de emergência
        const shouldRecruit = isEmergencyRecruitment || 
                             armiesInCountry.length < 3 || 
                             (armiesInCountry[0] && calculateArmySize(armiesInCountry[0]) < 3000);
        
        if (shouldRecruit) {
          const unitTypes = Object.keys(UNIT_DEFINITIONS) as Array<keyof typeof UNIT_DEFINITIONS>;
          const unitType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
          const def = UNIT_DEFINITIONS[unitType];
          
          // CORREÇÃO: Verificação estrita de recursos ANTES de recrutar
          if (updatedCountry.resources.gold >= def.cost && updatedCountry.resources.manpower >= def.manpowerCost) {
            // CORREÇÃO: Desconta os recursos ANTES de criar o exército
            updatedCountry.resources.gold -= def.cost;
            updatedCountry.resources.manpower -= def.manpowerCost;
            
            // CORREÇÃO: Atualiza o cooldown de recrutamento
            lastRecruitmentDay.set(country.tag, currentDay);
            
            // Adiciona regimento ao exército existente ou cria novo
            const targetProvince = ownedProvinces[Math.floor(Math.random() * ownedProvinces.length)];
            
            // Guard clause: verifica se targetProvince é válido
            if (!targetProvince || !targetProvince.id) {
              console.warn('AI: targetProvince inválido no recrutamento');
              // CORREÇÃO: Reverte os recursos se falhar
              updatedCountry.resources.gold += def.cost;
              updatedCountry.resources.manpower += def.manpowerCost;
              lastRecruitmentDay.delete(country.tag);
            } else {
              const existingArmy = updatedArmies.find(
                a => a && a.id && a.owner === country.tag && a.location === targetProvince.id
              );
              
              if (existingArmy) {
                updatedArmies = updatedArmies.map(a => 
                  a.id === existingArmy.id
                    ? { ...a, regiments: [...a.regiments, { type: unitType, strength: 1000, morale: 100 }] }
                    : a
                );
              } else {
                updatedArmies.push({
                  id: `army_${country.tag}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  owner: country.tag,
                  name: `${country.name} Army`,
                  regiments: [{ type: unitType, strength: 1000, morale: 100 }],
                  location: targetProvince.id,
                  destination: null,
                  movementProgress: 0,
                  movementSpeed: def.mobility,
                  position: null,
                  path: [],
                  targetArmyId: null,
                  targetProvinceId: null
                });
              }
              log = isEmergencyRecruitment 
                ? `🚨 ${country.name} recrutamento de emergência: ${def.name}`
                : `🗡️ ${country.name} recrutou ${def.name}`;
            }
          }
        }
      }
    }
  }

  // 3. Tomada de Decisão - Declarar guerra ou melhorar relações
  if (Math.random() < 0.01) { // 1% de chance por tick
    const neighbors = getNeighborCountries(country.tag, updatedProvinces, allCountries);
    
    for (const neighborTag of neighbors) {
      // REMOVIDO: if (neighborTag === 'IMP') continue; - Agora a IA pode atacar o jogador
      
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
    
    // CORREÇÃO: Permite ações mesmo sem guerra formal (invasão de províncias vazias)
    let enemy: string | null = null;
    
    console.log(`[DEBUG] ${country.tag} - Exército ${army.id} em ${currentProvince.name}, em guerra: ${atWarWith.length > 0}`);
    
    if (atWarWith.length > 0) {
      const war = atWarWith[0];
      enemy = war.attacker === country.tag ? war.defender : war.attacker;
      console.log(`[DEBUG] ${country.tag} - Já em guerra com ${enemy}`);
    } else {
      // Não está em guerra - busca províncias vazias para invadir
      console.log(`[DEBUG] ${country.tag} - Buscando províncias vizinhas vazias. Vizinhos: ${currentProvince.neighbors.join(', ')}`);
      
      const emptyEnemyProvinces = currentProvince.neighbors.filter(nId => {
        const neighbor = updatedProvinces.find(p => p.id === nId);
        if (!neighbor) {
          console.log(`[DEBUG] ${country.tag} - Vizinho ${nId} não encontrado em updatedProvinces`);
          return false;
        }
        
        // Verifica se a província está vazia (sem exércitos)
        const armiesInProvince = updatedArmies.filter(a => a.location === nId);
        const isEmpty = armiesInProvince.length === 0;
        const isEnemy = neighbor.owner !== country.tag;
        
        console.log(`[DEBUG] ${country.tag} - Vizinho ${neighbor.name} (${nId}): dono=${neighbor.owner}, exércitos=${armiesInProvince.length}, vazio=${isEmpty}, inimigo=${isEnemy}`);
        
        return isEmpty && isEnemy;
      });
      
      console.log(`[DEBUG] ${country.tag} - Províncias vazias encontradas: ${emptyEnemyProvinces.length}`);
      
      if (emptyEnemyProvinces.length > 0) {
        // Escolhe uma província vazia para invadir
        const targetProvId = emptyEnemyProvinces[0];
        const targetProv = updatedProvinces.find(p => p.id === targetProvId);
        
        if (targetProv && targetProv.owner !== country.tag) {
          // Declara guerra automaticamente ao invadir
          console.log(`[DEBUG] ${country.tag} - Invadindo província vazia ${targetProv.name}, declarando guerra a ${targetProv.owner}`);
          
          const result = declareWar(updatedRelations, updatedWars, country.tag, targetProv.owner, currentDate);
          updatedRelations = result.relations;
          updatedWars = result.wars;
          
          enemy = targetProv.owner;
          log = `⚔️ ${country.name} declarou guerra a ${targetProv.owner} ao invadir ${targetProv.name}!`;
        }
      }
      
      // Se ainda não encontrou inimigo, pula este exército
      if (!enemy) {
        console.log(`[DEBUG] ${country.tag} - Nenhum inimigo encontrado, pulando exército ${army.id}`);
        continue;
      }
    }
    
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
    
    // PRIORIDADE 4: INVASÃO DE PROVÍNCIAS INIMIGAS (Fronteiras Diretas Apenas)
    
    // Verifica se já tem um alvo de invasão travado
    if (army.targetProvinceId) {
      const targetProvince = updatedProvinces.find(p => p.id === army.targetProvinceId);
      
      // Se o alvo ainda existe e é inimigo, continua marchando
      if (targetProvince && targetProvince.owner === enemy) {
        console.log('AI DECISION:', army.id, `INVASION (LOCKED) - Mantendo alvo: ${targetProvince.name}`);
        
        // Se já está na província alvo, limpa o target
        if (army.location === army.targetProvinceId) {
          updatedArmies = updatedArmies.map(a => 
            a.id === army.id ? { ...a, targetProvinceId: null } : a
          );
          console.log('AI DECISION:', army.id, 'INVASION COMPLETE - Alvo conquistado');
        } else {
          // Move em direção ao alvo travado
          const nextStep = findPathTowards(army.location!, army.targetProvinceId, updatedProvinces);
          if (nextStep) {
            updatedArmies = updatedArmies.map(a => 
              a.id === army.id
                ? { ...a, destination: nextStep, movementProgress: 0, path: [] }
                : a
            );
          }
        }
        continue;
      } else {
        // Alvo não existe mais ou não é mais inimigo, limpa o target
        console.log('AI DECISION:', army.id, 'INVASION TARGET LOST - Limpando targetProvinceId');
        updatedArmies = updatedArmies.map(a => 
          a.id === army.id ? { ...a, targetProvinceId: null } : a
        );
      }
    }
    
    // Busca províncias inimigas adjacentes (fronteiras diretas apenas)
    console.log(`[DEBUG] ${country.tag} - Buscando províncias de ${enemy}`);
    const enemyNeighborProvinces = currentProvince.neighbors.filter(nId => {
      const neighbor = updatedProvinces.find(p => p.id === nId);
      const isEnemy = neighbor && neighbor.owner === enemy;
      console.log(`[DEBUG] ${country.tag} - Vizinho ${nId}: dono=${neighbor?.owner}, inimigo=${isEnemy}`);
      return isEnemy;
    });
    
    console.log(`[DEBUG] ${country.tag} - Províncias inimigas encontradas: ${enemyNeighborProvinces.length}`);
    
    if (enemyNeighborProvinces.length > 0) {
      const myStrength = calculateArmySize(army);
      console.log(`[DEBUG] ${country.tag} - Força do exército ${army.id}: ${myStrength}`);
      
      // Avalia cada província vizinha inimiga
      for (const enemyProvId of enemyNeighborProvinces) {
        const enemyProvince = updatedProvinces.find(p => p.id === enemyProvId);
        if (!enemyProvince) {
          console.log(`[DEBUG] ${country.tag} - Província ${enemyProvId} não encontrada`);
          continue;
        }
        
        // Verifica se há tropas inimigas na província
        const enemyTroopsInProvince = updatedArmies.filter(a => 
          a.owner === enemy && a.location === enemyProvId
        );
        const enemyStrengthInProvince = enemyTroopsInProvince.reduce(
          (sum, a) => sum + calculateArmySize(a), 0
        );
        
        console.log(`[DEBUG] ${country.tag} - Província ${enemyProvince.name}: tropas inimigas=${enemyStrengthInProvince}`);
        
        // REGRA: Território vazio vs Confronto
        if (enemyStrengthInProvince === 0) {
          // Província VAZIA - invadir mesmo com exército pequeno
          console.log('AI DECISION:', army.id, `INVADIR VAZIO - ${enemyProvince.name} sem tropas inimigas`);
          
          // CORREÇÃO: Atualiza targetProvinceId E destination em um único map
          updatedArmies = updatedArmies.map(a => {
            if (a.id === army.id) {
              console.log(`[DEBUG] ${country.tag} - Movendo exército ${army.id} para ${enemyProvId}`);
              return { 
                ...a, 
                targetProvinceId: enemyProvId,
                destination: enemyProvId,
                movementProgress: 0,
                path: []
              };
            }
            return a;
          });
          break; // Sai do loop após escolher um alvo
        } else {
          // Província com tropas inimigas - verifica ratio de força
          const forceRatio = myStrength / Math.max(1, enemyStrengthInProvince);
          
          if (forceRatio >= 1.2) {
            // IA é mais forte - pode atacar
            console.log('AI DECISION:', army.id, `INVADIR COM CONFRONTO - ${enemyProvince.name} (Ratio: ${forceRatio.toFixed(2)})`);
            
            // CORREÇÃO: Atualiza targetProvinceId E destination em um único map
            updatedArmies = updatedArmies.map(a => {
              if (a.id === army.id) {
                console.log(`[DEBUG] ${country.tag} - Movendo exército ${army.id} para ${enemyProvId} com confronto`);
                return { 
                  ...a, 
                  targetProvinceId: enemyProvId,
                  destination: enemyProvId,
                  movementProgress: 0,
                  path: []
                };
              }
              return a;
            });
            break; // Sai do loop após escolher um alvo
          } else {
            // IA é mais fraca - STAY/DEFEND
            console.log('AI DECISION:', army.id, `STAY/DEFEND - ${enemyProvince.name} tem tropas superiores (Ratio: ${forceRatio.toFixed(2)})`);
            // Não faz nada - mantém posição defensiva
            continue;
          }
        }
      }
    } else {
      console.log(`[DEBUG] ${country.tag} - Nenhuma província inimiga adjacente encontrada`);
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
