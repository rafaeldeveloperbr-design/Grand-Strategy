/**
 * ============================================================
 * MÓDULO 4 - Motor de IA (SIMPLIFICADO)
 * ============================================================
 * IA universal e simplificada para todos os bots
 * Regra única: mover para província vizinha com dono diferente
 */

import { Country, Province, Army } from '../types';
import { DiplomaticRelation, War } from '../types/diplomacy';

/**
 * Processa tick de IA para um país
 * Regra simplificada: mover para qualquer vizinho com dono diferente
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
  // Validação básica
  if (!country || !country.tag || !Array.isArray(armies) || !Array.isArray(provinces)) {
    return { armies, relations, wars, country, provinces };
  }

  let updatedArmies = [...armies];
  let log: string | undefined;

  // Filtra exércitos deste país que não estão em movimento
  const myArmies = updatedArmies.filter(army => 
    army && 
    army.owner === country.tag && 
    !army.destination &&
    army.location
  );

  // Para cada exército, tenta mover para província vizinha com dono diferente
  for (const army of myArmies) {
    const currentProvince = provinces.find(p => p.id === army.location);
    if (!currentProvince || !currentProvince.neighbors) continue;

    // Busca vizinhos com dono diferente do país atual
    const availableNeighbors = currentProvince.neighbors.filter(neighborId => {
      const neighborProvince = provinces.find(p => p.id === neighborId);
      return neighborProvince && neighborProvince.owner !== country.tag;
    });

    // Se encontrou vizinho com dono diferente, move para o primeiro
    if (availableNeighbors.length > 0) {
      const targetProvinceId = availableNeighbors[0];
      const targetProvince = provinces.find(p => p.id === targetProvinceId);
      
      if (targetProvince) {
        // Atualiza o exército com novo destino
        updatedArmies = updatedArmies.map(a => {
          if (a.id === army.id) {
            // Log apenas quando realmente mover
            log = `🏃 ${country.name} moveu exército para ${targetProvince.name}`;
            
            return {
              ...a,
              destination: targetProvinceId,
              movementProgress: 0,
              path: []
            };
          }
          return a;
        });
      }
    }
  }

  return {
    armies: updatedArmies,
    relations,
    wars,
    country,
    provinces,
    log
  };
}


