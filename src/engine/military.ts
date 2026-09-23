/**
 * ============================================================
 * MÓDULO 3 - Motor Militar
 * ============================================================
 * Gerencia recrutamento, movimentação de exércitos e integração
 * com o sistema de combate.
 */

import { Army, Province, Country, Recruitment, Regiment, UnitType } from '../types';
import { War } from '../types/diplomacy';
import { UNIT_DEFINITIONS } from '../data/units';
import { provincesData } from '../data/provinces';
import { calculateArmySize } from './combat';

/**
 * Gera um ID único para exércitos
 */
let armyIdCounter = 0;
export function generateArmyId(): string {
  return `army_${++armyIdCounter}`;
}

/**
 * Gera um ID único para recrutamentos
 */
let recruitmentIdCounter = 0;
export function generateRecruitmentId(): string {
  return `rec_${++recruitmentIdCounter}`;
}

/**
 * Cria um novo exército vazio
 */
export function createArmy(owner: string, name: string, location: string): Army {
  return {
    id: generateArmyId(),
    owner,
    name,
    regiments: [],
    location,
    destination: null,
    movementProgress: 0,
    movementSpeed: 1.0,
    position: null,
    path: [],
    targetArmyId: null,
    targetProvinceId: null,
  };
}

/**
 * Cria um regimento de um tipo específico
 */
export function createRegiment(type: UnitType): Regiment {
  return {
    type,
    strength: 1000,
    morale: 100,
  };
}

/**
 * Calcula a velocidade de um exército (baseada no regimento mais lento)
 */
export function calculateArmySpeed(army: Army): number {
  if (army.regiments.length === 0) return 1.0;
  
  let minSpeed = Infinity;
  for (const reg of army.regiments) {
    const def = UNIT_DEFINITIONS[reg.type];
    if (def.mobility < minSpeed) {
      minSpeed = def.mobility;
    }
  }
  
  return minSpeed === Infinity ? 1.0 : minSpeed;
}

/**
 * Processa recrutamentos em andamento
 */
export function processRecruitments(
  recruitments: Recruitment[],
  armies: Army[],
  countries: Country[]
): { recruitments: Recruitment[]; armies: Army[]; countries: Country[] } {
  const updatedRecruitments: Recruitment[] = [];
  let updatedArmies = [...armies];
  const updatedCountries = [...countries];

  for (const rec of recruitments) {
    const newDays = rec.daysRemaining - 1;

    if (newDays <= 0) {
      // Recrutamento concluído - cria o regimento
      const regiment = createRegiment(rec.unitType);
      
      // Verifica se já existe um exército nesta província
      const existingArmy = updatedArmies.find(
        a => a.owner === rec.owner && a.location === rec.provinceId
      );

      if (existingArmy) {
        // Adiciona ao exército existente
        updatedArmies = updatedArmies.map(a =>
          a.id === existingArmy.id
            ? { ...a, regiments: [...a.regiments, regiment] }
            : a
        );
      } else {
        // Cria novo exército
        const newArmy = createArmy(rec.owner, `Exército ${rec.provinceId}`, rec.provinceId);
        newArmy.regiments = [regiment];
        updatedArmies.push(newArmy);
      }
    } else {
      // Continua recrutando
      updatedRecruitments.push({ ...rec, daysRemaining: newDays });
    }
  }

  return {
    recruitments: updatedRecruitments,
    armies: updatedArmies,
    countries: updatedCountries,
  };
}

/**
 * Processa movimentação de exércitos (IMUTÁVEL)
 * Atualiza o progresso de movimento de TODOS os exércitos que possuem destino
 */
export function processArmyMovement(
  armies: Army[],
  provinces: Province[]
): { updatedArmies: Army[]; arrivedArmies: Army[] } {
  const arrivedArmies: Army[] = [];

  // Usa map para processar TODOS os exércitos de forma imutável
  const updatedArmies = armies.map(army => {
    // Se não tem destino, permanece parado
    if (!army.destination) {
      return army;
    }

    // Incrementa progresso
    const nextProgress = army.movementProgress + army.movementSpeed;

    // Se ainda não chegou ao destino (progress < 1.0)
    if (nextProgress < 1.0) {
      // Calcula posição intermediária para animação
      const originProvince = provinces.find(p => p.id === army.location);
      const destProvince = provinces.find(p => p.id === army.destination);
      
      let position = null;
      if (originProvince && destProvince) {
        position = {
          x: originProvince.center.x + (destProvince.center.x - originProvince.center.x) * nextProgress,
          y: originProvince.center.y + (destProvince.center.y - originProvince.center.y) * nextProgress,
        };
      }

      return { 
        ...army, 
        movementProgress: nextProgress,
        position
      };
    }

    // CHEGOU AO DESTINO (progress >= 1.0)
    const targetProvinceId = army.destination;
    
    // Transiciona localização e reseta destino
    const arrivedArmy: Army = {
      ...army,
      location: targetProvinceId,
      destination: null,
      movementProgress: 0,
      position: null,
      path: [],
    };
    
    arrivedArmies.push(arrivedArmy);
    
    // Retorna o exército que chegou (será removido do array principal)
    return arrivedArmy;
  });

  // Remove exércitos que chegaram do array principal (eles estão em arrivedArmies)
  const movingArmies = updatedArmies.filter(army => {
    const hasArrived = arrivedArmies.some(a => a.id === army.id);
    return !hasArrived;
  });

  return { updatedArmies: movingArmies, arrivedArmies };
}

/**
 * Inicia o movimento de um exército para uma província (vizinha ou distante)
 * Usa pathfinding para destinos não-vizinhos
 */
export function moveArmy(
  army: Army,
  destinationId: string,
  provinces: Province[],
  wars?: War[]
): Army | null {
  if (!army.location) return null;
  if (army.destination) return null; // Já está se movendo

  const originProvince = provinces.find(p => p.id === army.location);
  if (!originProvince) return null;

  // Se é vizinho direto, move sem pathfinding
  if (originProvince.neighbors.includes(destinationId)) {
    return {
      ...army,
      destination: destinationId,
      movementProgress: 0,
      movementSpeed: calculateArmySpeed(army),
      path: [],
    };
  }

  // Usa pathfinding para destino distante
  console.log('🗺️ Calculando pathfinding:', { from: army.location, to: destinationId, owner: army.owner, wars: wars?.length });
  const path = findPath(army.location, destinationId, provinces, army.owner, wars);
  console.log('🗺️ Caminho encontrado:', path);
  if (path.length === 0) {
    console.log('❌ Caminho não encontrado');
    return null; // Caminho não encontrado
  }

  const nextDestination = path[0];
  const remainingPath = path.slice(1);

  return {
    ...army,
    destination: nextDestination,
    movementProgress: 0,
    movementSpeed: calculateArmySpeed(army),
    path: remainingPath,
  };
}

/**
 * Obtém todos os exércitos em uma província
 */
export function getArmiesInProvince(armies: Army[], provinceId: string): Army[] {
  return armies.filter(a => a.location === provinceId);
}

/**
 * Obtém exércitos inimigos em uma província
 */
export function getEnemyArmiesInProvince(
  armies: Army[],
  provinceId: string,
  ownerTag: string
): Army[] {
  return armies.filter(a => a.location === provinceId && a.owner !== ownerTag);
}

/**
 * Obtém todos os exércitos amigáveis em uma província
 */
export function getFriendlyArmiesInProvince(
  armies: Army[],
  provinceId: string,
  ownerTag: string
): Army[] {
  return armies.filter(
    a => a.location === provinceId && a.owner === ownerTag && !a.destination
  );
}

/**
 * Funde dois exércitos em um único exército maior.
 * Combina todos os regimentos de ambos os exércitos.
 * O exército resultante mantém o ID e nome do primeiro exército.
 */
export function mergeArmies(army1: Army, army2: Army): Army {
  // Combina regimentos de ambos os exércitos
  const mergedRegiments = [...army1.regiments, ...army2.regiments];

  return {
    ...army1,
    regiments: mergedRegiments,
    // Recalcula velocidade baseada no novo conjunto de regimentos
    movementSpeed: calculateArmySpeed({ ...army1, regiments: mergedRegiments }),
  };
}

/**
 * Calcula o offset visual para exércitos agrupados na mesma província.
 * Usa disposição circular ao redor do centro.
 * 
 * @param index - Índice do exército no grupo (0-based)
 * @param total - Total de exércitos no grupo
 * @returns Offset {x, y} a ser aplicado à posição base
 */
export function calculateArmyOffset(
  index: number,
  total: number
): { offsetX: number; offsetY: number } {
  // Se há apenas 1 exército, sem offset
  if (total <= 1) {
    return { offsetX: 0, offsetY: 0 };
  }

  // Raio da disposição circular (em unidades SVG)
  const radius = 18 + (total > 4 ? (total - 4) * 3 : 0);
  
  // Ângulo base (começa no topo, -90 graus)
  const angleStep = (2 * Math.PI) / total;
  const angle = angleStep * index - Math.PI / 2;

  return {
    offsetX: Math.cos(angle) * radius,
    offsetY: Math.sin(angle) * radius,
  };
}

/**
 * Algoritmo BFS para encontrar o caminho mais curto entre duas províncias.
 * Restringe o caminho a províncias permitidas (próprias ou ocupadas).
 * 
 * @param startId - ID da província de origem
 * @param endId - ID da província de destino
 * @param provinces - Lista de todas as províncias
 * @param ownerTag - Tag do país dono do exército
 * @returns Array de IDs de províncias no caminho (excluindo startId, incluindo endId)
 */
export function findPath(
  startId: string,
  endId: string,
  provinces: Province[],
  ownerTag: string,
  wars?: War[]
): string[] {
  if (startId === endId) return [];

  // Cria mapa de adjacência
  const adjacencyMap = new Map<string, string[]>();
  for (const province of provinces) {
    adjacencyMap.set(province.id, province.neighbors);
  }

  // BFS
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === endId) {
      // Reconstrói o caminho
      const path: string[] = [];
      let node: string | undefined = endId;
      while (node && node !== startId) {
        path.unshift(node);
        node = parent.get(node);
      }
      return path;
    }

    const neighbors = adjacencyMap.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;

      // Verifica se a província é permitida
      const neighborProvince = provinces.find(p => p.id === neighbor);
      if (!neighborProvince) continue;

      // Permite atravessar:
      // 1. Províncias próprias
      // 2. O destino final (sempre permitido)
      // 3. Províncias de países inimigos (se houver guerra ativa)
      let isAllowed = neighborProvince.owner === ownerTag || neighbor === endId;
      
      // Verifica se há guerra com o dono da província
      if (!isAllowed && wars && wars.length > 0) {
        const hasWarWithOwner = wars.some(
          w => (w.attacker === ownerTag && w.defender === neighborProvince.owner) ||
               (w.defender === ownerTag && w.attacker === neighborProvince.owner)
        );
        console.log('🔍 Verificando guerra para província', neighbor, ':', { owner: neighborProvince.owner, hasWar: hasWarWithOwner });
        if (hasWarWithOwner) {
          isAllowed = true;
        }
      }
      
      if (isAllowed) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  // Caminho não encontrado
  return [];
}

/**
 * Divide um exército em dois, transferindo regimentos específicos.
 * 
 * @param sourceArmy - Exército original
 * @param regimentsToTransfer - Índices dos regimentos a serem transferidos
 * @param newName - Nome do novo exército
 * @returns Novo exército com os regimentos transferidos, ou null se inválido
 */
export function splitArmy(
  sourceArmy: Army,
  regimentsToTransfer: number[],
  newName: string
): Army | null {
  if (regimentsToTransfer.length === 0) return null;
  if (regimentsToTransfer.length >= sourceArmy.regiments.length) return null;

  // Valida índices
  for (const idx of regimentsToTransfer) {
    if (idx < 0 || idx >= sourceArmy.regiments.length) return null;
  }

  // Separa regimentos
  const transferredRegiments = regimentsToTransfer.map(idx => ({ ...sourceArmy.regiments[idx] }));
  const remainingRegiments = sourceArmy.regiments.filter((_, idx) => !regimentsToTransfer.includes(idx));

  // Cria novo exército
  const newArmy: Army = {
    id: generateArmyId(),
    owner: sourceArmy.owner,
    name: newName,
    regiments: transferredRegiments,
    location: sourceArmy.location,
    destination: null,
    movementProgress: 0,
    movementSpeed: calculateArmySpeed({ ...sourceArmy, regiments: transferredRegiments }),
    position: null,
    path: [],
  };

  return newArmy;
}

/**
 * Divide um exército ao meio (50% / 50%)
 */
export function splitArmyHalf(sourceArmy: Army, newName: string): Army | null {
  if (sourceArmy.regiments.length < 2) return null;

  const halfIndex = Math.floor(sourceArmy.regiments.length / 2);
  const indicesToTransfer = Array.from({ length: halfIndex }, (_, i) => i);

  return splitArmy(sourceArmy, indicesToTransfer, newName);
}
