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
  const myArmies = updatedArmies.filter(army => {
    const isValid = army && 
      army.owner === country.tag && 
      !army.destination &&  // Não está se movendo
      army.location;
    
    if (army && army.owner === country.tag) {
      console.log(`🔍 [IA] ${country.name}: Exército ${army.id} - location=${army.location}, destination=${army.destination || 'null'}, movementProgress=${army.movementProgress}`);
    }
    
    return isValid;
  });

  // Para cada exército, tenta mover para província vizinha com dono diferente
  console.log(`🔍 [IA] ${country.name}: Verificando ${myArmies.length} exércitos`);
  console.log(`📊 [IA] Total de províncias no mapa: ${provinces.length}`);
  
  for (const army of myArmies) {
    console.log(`🔍 [IA] ${country.name}: Processando exército ${army.id} em ${army.location}`);
    
    const currentProvince = provinces.find(p => p.id === army.location);
    
    // Debug: verificar se encontrou a província
    if (!currentProvince) {
      console.error(`❌ [IA] ${country.name}: Província ${army.location} NÃO ENCONTRADA no array de províncias!`);
      console.log(`📋 [IA] IDs disponíveis:`, provinces.map(p => p.id).join(', '));
      continue;
    }
    
    if (!currentProvince.neighbors || currentProvince.neighbors.length === 0) {
      console.log(`⚠️ [IA] ${country.name}: Exército ${army.id} em ${currentProvince.name} sem vizinhos`);
      continue;
    }

    console.log(`🔍 [IA] ${country.name}: Exército ${army.id} em ${currentProvince.name} (owner: ${currentProvince.owner})`);
    console.log(`🔍 [IA] ${country.name}: Vizinhos: [${currentProvince.neighbors.join(', ')}]`);

    // Busca vizinhos com dono diferente do país atual
    const availableNeighbors: string[] = [];
    
    for (const neighborId of currentProvince.neighbors) {
      const neighborProvince = provinces.find(p => p.id === neighborId);
      
      if (!neighborProvince) {
        console.warn(`⚠️ [IA] ${country.name}: Vizinho ${neighborId} NÃO ENCONTRADO!`);
        continue;
      }
      
      const isAvailable = neighborProvince.owner !== country.tag;
      console.log(`  → ${neighborId} (${neighborProvince.name}): dono=${neighborProvince.owner}, meu país=${country.tag}, disponível=${isAvailable}`);
      
      if (isAvailable) {
        availableNeighbors.push(neighborId);
      }
    }

    console.log(`🔍 [IA] ${country.name}: ${availableNeighbors.length} vizinhos disponíveis: [${availableNeighbors.join(', ')}]`);

    // Se encontrou vizinho com dono diferente, move para o primeiro
    if (availableNeighbors.length > 0) {
      const targetProvinceId = availableNeighbors[0];
      const targetProvince = provinces.find(p => p.id === targetProvinceId);
      
      if (targetProvince) {
        console.log(`✅ [IA] ${country.name}: Movendo exército ${army.id} para ${targetProvince.name} (${targetProvinceId})`);
        
        // Atualiza o exército com novo destino
        updatedArmies = updatedArmies.map(a => {
          if (a.id === army.id) {
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
      } else {
        console.error(`❌ [IA] ${country.name}: Província alvo ${targetProvinceId} não encontrada!`);
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


