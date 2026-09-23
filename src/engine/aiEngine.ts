/**
 * ============================================================
 * MÓDULO 4 - Motor de IA (CLEAN SLATE)
 * ============================================================
 * IA minimalista e imutável com validação diplomática
 * Regra: atribuir destino para exércitos parados respeitando relações diplomáticas
 * Em tempos de paz, exércitos se posicionam estrategicamente nas fronteiras
 */

import { Army, Province } from '../types';
import { DiplomaticRelation } from '../types/diplomacy';

/**
 * Verifica se um exército pode se mover para uma província específica
 * baseado nas relações diplomáticas
 */
function canMoveToProvince(
  botCountryId: string,
  targetProvinceOwner: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  // Se o dono da província é o próprio bot, sempre pode mover
  if (targetProvinceOwner === botCountryId) {
    return true;
  }

  // Busca a relação diplomática entre o bot e o dono da província
  const relation = diplomacy.find(
    r => (r.countryA === botCountryId && r.countryB === targetProvinceOwner) ||
         (r.countryA === targetProvinceOwner && r.countryB === botCountryId)
  );

  // Se não houver relação cadastrada (neutro/paz padrão), movimento proibido
  if (!relation) {
    return false;
  }

  // Permite movimento APENAS se estiver em guerra
  // (não há sistema de aliança implementado ainda)
  return relation.status === 'war';
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

    // Verifica se está em guerra com este vizinho
    const relation = diplomacy.find(
      r => (r.countryA === botCountryId && r.countryB === neighborProv.owner) ||
           (r.countryA === neighborProv.owner && r.countryB === botCountryId)
    );

    return relation && relation.status === 'war';
  });
}

/**
 * Processa IA para um bot
 * Atribui destinos apenas para exércitos PARADOS (destination === null)
 * Respeita as relações diplomáticas para validar movimentos
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
  diplomacy: DiplomaticRelation[]
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

      // Prioriza províncias de guerra (dono diferente do bot)
      const warTargets = validNeighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        return prov && prov.owner !== botCountryId;
      });

      // Se houver alvos de guerra, escolhe um aleatoriamente entre eles
      if (warTargets.length > 0) {
        const chosenDestination = warTargets[Math.floor(Math.random() * warTargets.length)];
        return {
          ...army,
          destination: chosenDestination,
          movementProgress: 0
        };
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
      return {
        ...army,
        destination: chosenDestination,
        movementProgress: 0
      };
    }

    // Se nenhuma vizinha é de fronteira, escolhe qualquer vizinho próprio para continuar avançando
    const ownNeighbors = currentProv.neighbors.filter(neighborId => {
      const prov = provinces.find(p => p.id === neighborId);
      return prov && prov.owner === botCountryId;
    });

    if (ownNeighbors.length > 0) {
      const chosenDestination = ownNeighbors[Math.floor(Math.random() * ownNeighbors.length)];
      return {
        ...army,
        destination: chosenDestination,
        movementProgress: 0
      };
    }

    // Se não houver opções, fica parado
    return army;
  });
}
