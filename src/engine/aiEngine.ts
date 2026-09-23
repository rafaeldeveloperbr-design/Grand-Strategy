/**
 * ============================================================
 * MÓDULO 4 - Motor de IA (CLEAN SLATE)
 * ============================================================
 * IA minimalista e imutável com validação diplomática
 * Regra: atribuir destino para exércitos parados respeitando relações diplomáticas
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
 * Processa IA para um bot
 * Atribui destinos apenas para exércitos PARADOS (destination === null)
 * Respeita as relações diplomáticas para validar movimentos
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
    // Caso contrário, escolhe qualquer vizinho válido (movimento interno/aliado)
    const candidates = warTargets.length > 0 ? warTargets : validNeighbors;
    const chosenDestination = candidates[Math.floor(Math.random() * candidates.length)];

    // Atribui destino (mantém movementProgress em 0)
    return {
      ...army,
      destination: chosenDestination,
      movementProgress: 0
    };
  });
}
