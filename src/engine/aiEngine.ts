/**
 * ============================================================
 * MÓDULO 4 - Motor de IA (CLEAN SLATE)
 * ============================================================
 * IA minimalista e imutável com validação diplomática
 * Regra: atribuir destino para exércitos parados respeitando relações diplomáticas
 * Em tempos de paz, exércitos se posicionam estrategicamente nas fronteiras
 */

import { Army, Province } from '../types';
import { DiplomaticRelation, War } from '../types/diplomacy';
import { findPath } from './military';

/**
 * Verifica se um exército pode se mover para uma província específica
 * baseado nas relações diplomáticas.
 * Normaliza automaticamente chaves de objeto e maiúsculas/minúsculas.
 */
function canMoveToProvince(
  botCountryId: string,
  targetProvinceOwner: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  // 1. Território próprio: SEMPRE permitido
  if (targetProvinceOwner === botCountryId) {
    return true;
  }

  // Se não houver array de diplomacia ou estiver vazio
  if (!diplomacy || !Array.isArray(diplomacy) || diplomacy.length === 0) {
    return false;
  }

  // 2. Busca relação testando TODAS as variações comuns de nomenclatura de chaves
  const relation = diplomacy.find(r => {
    const c1 = r.countryA || (r as any).country1Id || (r as any).country1 || (r as any).from;
    const c2 = r.countryB || (r as any).country2Id || (r as any).country2 || (r as any).to;

    return (c1 === botCountryId && c2 === targetProvinceOwner) ||
           (c1 === targetProvinceOwner && c2 === botCountryId);
  });

  if (!relation) {
    return false;
  }

  // 3. Extrai o status testando variações de nome de propriedade e converte para minúsculo
  const rawStatus = relation.status || (relation as any).type || (relation as any).state || '';
  const normalizedStatus = String(rawStatus).toLowerCase().trim();

  // Permite movimento para GUERRA ('war') ou ALIANÇA ('alliance')
  return normalizedStatus === 'war' || normalizedStatus === 'alliance';
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

    // Verifica se está em guerra com este vizinho (com tolerância de chaves)
    const relation = diplomacy.find(r => {
      const c1 = r.countryA || (r as any).country1Id || (r as any).country1 || (r as any).from;
      const c2 = r.countryB || (r as any).country2Id || (r as any).country2 || (r as any).to;
      return (c1 === botCountryId && c2 === neighborProv.owner) ||
             (c1 === neighborProv.owner && c2 === botCountryId);
    });

    if (!relation) return false;

    const rawStatus = relation.status || (relation as any).type || (relation as any).state || '';
    const normalizedStatus = String(rawStatus).toLowerCase().trim();
    return normalizedStatus === 'war';
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
  const relation = diplomacy.find(r => {
    const c1 = r.countryA || (r as any).country1Id || (r as any).country1 || (r as any).from;
    const c2 = r.countryB || (r as any).country2Id || (r as any).country2 || (r as any).to;
    return (c1 === countryA && c2 === countryB) ||
           (c1 === countryB && c2 === countryA);
  });

  if (!relation) return false;

  const rawStatus = relation.status || (relation as any).type || (relation as any).state || '';
  const normalizedStatus = String(rawStatus).toLowerCase().trim();
  return normalizedStatus === 'war';
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
