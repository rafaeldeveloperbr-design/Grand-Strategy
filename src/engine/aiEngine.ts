/**
 * ============================================================
 * MÓDULO 4 - Motor de IA (CLEAN SLATE)
 * ============================================================
 * IA minimalista e imutável
 * Regra única: atribuir destino para exércitos parados
 */

import { Army, Province } from '../types';

/**
 * Processa IA para um bot
 * Atribui destinos apenas para exércitos PARADOS (destination === null)
 */
export function processAI(
  botCountryId: string,
  armies: Army[],
  provinces: Province[]
): Army[] {
  // Validação básica
  if (!botCountryId || !Array.isArray(armies) || !Array.isArray(provinces)) {
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

    // Prioriza vizinhos que NÃO pertencem ao Bot (províncias para invadir/conquistar)
    const enemyNeighbors = currentProv.neighbors.filter(neighborId => {
      const prov = provinces.find(p => p.id === neighborId);
      return prov && prov.owner !== botCountryId;
    });

    // Se houver inimigos, escolhe um deles; caso contrário, escolhe qualquer vizinho
    const candidates = enemyNeighbors.length > 0 ? enemyNeighbors : currentProv.neighbors;
    const chosenDestination = candidates[Math.floor(Math.random() * candidates.length)];

    // Atribui destino (mantém movementProgress em 0)
    return {
      ...army,
      destination: chosenDestination,
      movementProgress: 0
    };
  });
}
