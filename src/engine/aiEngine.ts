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
  console.log(`🔍 [IA] ${country.name}: Verificando ${myArmies.length} exércitos`);
  
  for (const army of myArmies) {
    const currentProvince = provinces.find(p => p.id === army.location);
    if (!currentProvince || !currentProvince.neighbors) {
      console.log(`⚠️ [IA] ${country.name}: Exército ${army.id} sem província atual ou vizinhos`);
      continue;
    }

    console.log(`🔍 [IA] ${country.name}: Exército ${army.id} em ${currentProvince.name}, vizinhos: ${currentProvince.neighbors.length}`);

    // Busca vizinhos com dono diferente do país atual
    const availableNeighbors = currentProvince.neighbors.filter(neighborId => {
      const neighborProvince = provinces.find(p => p.id === neighborId);
      const isAvailable = neighborProvince && neighborProvince.owner !== country.tag;
      if (neighborProvince) {
        console.log(`  → Vizinho ${neighborProvince.name}: dono=${neighborProvince.owner}, disponível=${isAvailable}`);
      }
      return isAvailable;
    });

    console.log(`🔍 [IA] ${country.name}: ${availableNeighbors.length} vizinhos disponíveis`);

    // Se encontrou vizinho com dono diferente, move para o primeiro
    if (availableNeighbors.length > 0) {
      const targetProvinceId = availableNeighbors[0];
      const targetProvince = provinces.find(p => p.id === targetProvinceId);
      
      if (targetProvince) {
        console.log(`✅ [IA] ${country.name}: Movendo exército ${army.id} para ${targetProvince.name}`);
        
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
    } else {
      console.log(`⚠️ [IA] ${country.name}: Exército ${army.id} sem vizinhos disponíveis para mover`);
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


