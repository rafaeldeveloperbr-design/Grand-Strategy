/**
 * ============================================================
 * MÓDULO 3 - Motor Militar
 * ============================================================
 * Gerencia recrutamento, movimentação de exércitos e integração
 * com o sistema de combate.
 */

import { Army, Province, Country, Recruitment, Regiment, UnitType } from '../types';
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
  let updatedCountries = [...countries];

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
 * Processa movimentação de exércitos
 */
export function processArmyMovement(
  armies: Army[],
  provinces: Province[]
): { armies: Army[]; arrivedArmies: Army[] } {
  const updatedArmies: Army[] = [];
  const arrivedArmies: Army[] = [];

  for (const army of armies) {
    if (!army.destination) {
      // Não está se movendo
      updatedArmies.push(army);
      continue;
    }

    // Avança o movimento
    const newProgress = army.movementProgress + army.movementSpeed;

    if (newProgress >= 1.0) {
      // Chegou ao destino
      const arrivedArmy: Army = {
        ...army,
        location: army.destination,
        destination: null,
        movementProgress: 0,
        position: null,
      };
      arrivedArmies.push(arrivedArmy);
    } else {
      // Continua se movendo - calcula posição intermediária
      const originProvince = provinces.find(p => p.id === army.location);
      const destProvince = provinces.find(p => p.id === army.destination);
      
      let position = null;
      if (originProvince && destProvince) {
        position = {
          x: originProvince.center.x + (destProvince.center.x - originProvince.center.x) * newProgress,
          y: originProvince.center.y + (destProvince.center.y - originProvince.center.y) * newProgress,
        };
      }

      updatedArmies.push({
        ...army,
        movementProgress: newProgress,
        position,
      });
    }
  }

  return { armies: updatedArmies, arrivedArmies };
}

/**
 * Inicia o movimento de um exército para uma província vizinha
 */
export function moveArmy(
  army: Army,
  destinationId: string,
  provinces: Province[]
): Army | null {
  // Verifica se o destino é vizinho
  const originProvince = provinces.find(p => p.id === army.location);
  if (!originProvince || !originProvince.neighbors.includes(destinationId)) {
    return null; // Destino não é vizinho
  }

  return {
    ...army,
    destination: destinationId,
    movementProgress: 0,
    movementSpeed: calculateArmySpeed(army),
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
