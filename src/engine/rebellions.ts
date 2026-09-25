/**
 * ============================================================
 * SISTEMA DE REVOLTAS E IA SEPARATISTA
 * ============================================================
 * - Acúmulo de 1.000 tropas por ciclo de revolta
 * - Ativação de modo separatista ao atingir 5.000 tropas
 * - IA de marcha restrita: ataca apenas províncias do originalOwner
 */

import { Army, Province } from '../types';
import { DiplomaticRelation } from '../types/diplomacy';
import { createRegiment, moveArmy, findPath } from './military';
import { getCountryByTag } from '../data/countries';

/** Tropas geradas por ciclo de revolta */
export const REBEL_ACCUMULATION_RATE = 1000;

/** Limiar para ativar modo separatista */
export const SEPARATIST_THRESHOLD = 5000;

export interface RebelProcessingResult {
  updatedArmies: Army[];
  updatedProvinces: Province[];
  notifications: string[];
  logs: string[];
}

/**
 * Verifica se um exército é rebelde (pelo owner)
 */
export function isRebelArmy(army: Army): boolean {
  return army.owner.startsWith('rebel_');
}

/**
 * Calcula o total de tropas de um exército
 */
function getArmyTotalTroops(army: Army): number {
  return army.regiments.reduce((sum, r) => sum + Math.floor(r.strength), 0);
}

/**
 * Gera um ID único para exércitos rebeldes
 */
let rebelArmyIdCounter = 0;
function generateRebelArmyId(): string {
  rebelArmyIdCounter++;
  return `rebel_army_${Date.now()}_${rebelArmyIdCounter}`;
}

/**
 * PROCESSA ACÚMULO DE TROPAS REBELDES
 * - Se já existe rebelde na província: soma +1.000
 * - Se não existe: cria novo exército com 1.000 tropas
 * - Ao atingir 5.000: ativa separatistMode
 */
export function processRebelAccumulation(
  provinces: Province[],
  armies: Army[],
  revoltedProvinceIds: string[]
): RebelProcessingResult {
  let updatedArmies = [...armies];
  const updatedProvinces = [...provinces];
  const notifications: string[] = [];
  const logs: string[] = [];

  for (const provId of revoltedProvinceIds) {
    const province = updatedProvinces.find(p => p.id === provId);
    if (!province) continue;

    // Encontra exército rebelde JÁ EXISTENTE nesta província
    const rebelArmyIndex = updatedArmies.findIndex(
      a => a.location === provId && isRebelArmy(a) && !a.destination
    );

    if (rebelArmyIndex !== -1) {
      // ✅ JÁ EXISTE REBELDE: SOMA +1.000 TROPAS
      const rebelArmy = { ...updatedArmies[rebelArmyIndex] };
      const infantryIndex = rebelArmy.regiments.findIndex(r => r.type === 'infantry');

      if (infantryIndex !== -1) {
        // Soma no regimento de infantaria existente
        const updatedRegiments = [...rebelArmy.regiments];
        updatedRegiments[infantryIndex] = {
          ...updatedRegiments[infantryIndex],
          strength: updatedRegiments[infantryIndex].strength + REBEL_ACCUMULATION_RATE,
        };
        rebelArmy.regiments = updatedRegiments;
      } else {
        // Cria novo regimento de infantaria
        const newReg = createRegiment('infantry');
        newReg.strength = REBEL_ACCUMULATION_RATE;
        rebelArmy.regiments = [...rebelArmy.regiments, newReg];
      }

      const totalTroops = getArmyTotalTroops(rebelArmy);
      console.log(`🔥 Rebeldes em ${province.name} acumularam +${REBEL_ACCUMULATION_RATE} (total: ${totalTroops})`);

      // 🚨 VERIFICA SE ATINGIU 5.000 TROPAS
      if (totalTroops >= SEPARATIST_THRESHOLD && !rebelArmy.separatistMode) {
        rebelArmy.separatistMode = true;
        const countryName = getCountryByTag(rebelArmy.originalOwner || '')?.name || 'país desconhecido';
        
        notifications.push(
          `⚠️ Exército Separatista atingiu 5.000 tropas e iniciou a marcha de reconquista!`
        );
        logs.push(
          `⚔️ Rebeldes de ${countryName} atingiram 5k e estão atacando para reconquistar seus territórios originais!`
        );
        console.log(`⚔️ Rebeldes de ${countryName} atingiram 5k e estão atacando para reconquistar seus territórios originais!`);
      }

      updatedArmies[rebelArmyIndex] = rebelArmy;
    } else {
      // ❌ NÃO EXISTE REBELDE: CRIA NOVO EXÉRCITO COM 1.000 TROPAS
      const originalOwner = province.originalOwner || province.owner;
      const countryName = getCountryByTag(originalOwner)?.name || province.name;
      const rebelOwnerTag = `rebel_${provId}`;

      const newRebelArmy: Army = {
        id: generateRebelArmyId(),
        owner: rebelOwnerTag,
        name: `Rebeldes de ${countryName}`,
        regiments: [],
        location: provId,
        destination: null,
        targetDestination: null,
        movementProgress: 0,
        movementSpeed: 0.75,
        position: null,
        path: [],
        targetArmyId: null,
        targetProvinceId: null,
        originalOwner: originalOwner,
        separatistMode: false,
      };

      const reg = createRegiment('infantry');
      reg.strength = REBEL_ACCUMULATION_RATE;
      newRebelArmy.regiments = [reg];

      updatedArmies = [...updatedArmies, newRebelArmy];
      console.log(`🔥 Novo exército rebelde criado em ${province.name} (${REBEL_ACCUMULATION_RATE} tropas)`);
    }
  }

  return { updatedArmies, updatedProvinces, notifications, logs };
}

/**
 * IA SEPARATISTA - MARCHA RESTRITA
 * Rebeldes em modo separatista atacam APENAS províncias que:
 * - originalOwner === army.originalOwner (eram deles)
 * - owner !== army.originalOwner (foram conquistadas)
 * 
 * NUNCA atacam províncias nativas do jogador (que sempre pertenceram a ele).
 */
export function processSeparatistAI(
  armies: Army[],
  provinces: Province[],
  diplomaticRelations: DiplomaticRelation[]
): Army[] {
  let updatedArmies = [...armies];

  const separatistArmies = updatedArmies.filter(
    a => isRebelArmy(a) && a.separatistMode === true
  );

  for (const army of separatistArmies) {
    // Se já está se movendo, não processa novamente
    if (!army.location || army.destination) continue;

    const currentProvince = provinces.find(p => p.id === army.location);
    if (!currentProvince) continue;

    // 🎯 ESTRATÉGIA 1: Verifica vizinhos diretos que são alvos válidos
    const validNeighborTargets = currentProvince.neighbors.filter(neighborId => {
      const neighborProv = provinces.find(p => p.id === neighborId);
      if (!neighborProv) return false;
      return (
        neighborProv.originalOwner === army.originalOwner &&
        neighborProv.owner !== army.originalOwner
      );
    });

    if (validNeighborTargets.length > 0) {
      // Ataca o primeiro alvo vizinho válido
      const targetId = validNeighborTargets[0];
      const targetProv = provinces.find(p => p.id === targetId);
      const movedArmy = moveArmy(army, targetId, provinces, diplomaticRelations);

      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx !== -1 && movedArmy) {
        updatedArmies[idx] = movedArmy;
        console.log(`⚔️ Separatistas de ${army.name} marcham para reconquistar ${targetProv?.name}`);
      }
      continue;
    }

    // 🎯 ESTRATÉGIA 2: Não há vizinho válido - busca caminho até a província-alvo mais próxima
    const allValidTargets = provinces.filter(p =>
      p.originalOwner === army.originalOwner &&
      p.owner !== army.originalOwner
    );

    if (allValidTargets.length === 0) {
      // Não há mais territórios para reconquistar - para o modo separatista
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx !== -1) {
        updatedArmies[idx] = { ...army, separatistMode: false };
        console.log(`✅ ${army.name} não tem mais territórios para reconquistar`);
      }
      continue;
    }

    // Encontra o alvo com caminho mais curto
    let bestTarget: Province | null = null;
    let bestPath: string[] = [];

    for (const target of allValidTargets) {
      const path = findPath(army.location, target.id, provinces, army.owner, diplomaticRelations);
      if (path.length > 0 && (bestPath.length === 0 || path.length < bestPath.length)) {
        bestTarget = target;
        bestPath = path;
      }
    }

    if (bestTarget && bestPath.length > 0) {
      const nextStepId = bestPath[0];
      const movedArmy = moveArmy(army, nextStepId, provinces, diplomaticRelations);

      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx !== -1 && movedArmy) {
        updatedArmies[idx] = movedArmy;
        console.log(`🚶 ${army.name} marcha em direção a ${bestTarget.name} (rota: ${bestPath.length} províncias)`);
      }
    }
  }

  return updatedArmies;
}

/**
 * Verifica se um exército rebelde venceu e deve devolver o território
 * Retorna o novo owner (originalOwner) ou null se não for caso de devolução
 */
export function checkRebelTerritoryReturn(winnerArmy: Army): string | null {
  if (isRebelArmy(winnerArmy) && winnerArmy.originalOwner) {
    return winnerArmy.originalOwner;
  }
  return null;
}