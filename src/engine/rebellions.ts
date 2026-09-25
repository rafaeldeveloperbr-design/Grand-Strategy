/**
 * ============================================================
 * SISTEMA DE REVOLTAS E IA SEPARATISTA (VERSÃO FINAL)
 * ============================================================
 * REGRAS:
 * - Acúmulo de 1.000 tropas por ciclo de revolta
 * - Aos 5.000: ativa separatistMode
 * - SÓ ataca províncias com originalOwner dele que estão ocupadas
 * - NUNCA entra em território estrangeiro (exceto o histórico dele)
 * - Ao completar a reconquista: integrado ao exército nacional
 */

import { Army, Province } from '../types';
import { createRegiment } from './military';
import { getCountryByTag } from '../data/countries';

export const REBEL_ACCUMULATION_RATE = 1000;
export const SEPARATIST_THRESHOLD = 5000;

export interface RebelProcessingResult {
  updatedArmies: Army[];
  updatedProvinces: Province[];
  notifications: string[];
  logs: string[];
}

export function isRebelArmy(army: Army): boolean {
  return army.owner.startsWith('rebel_');
}

function getArmyTotalTroops(army: Army): number {
  return army.regiments.reduce((sum, r) => sum + Math.floor(r.strength), 0);
}

let rebelArmyIdCounter = 0;
function generateRebelArmyId(): string {
  rebelArmyIdCounter++;
  return `rebel_army_${Date.now()}_${rebelArmyIdCounter}`;
}

/**
 * ACÚMULO DE TROPAS REBELDES (+1.000 por ciclo)
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

    const rebelArmyIndex = updatedArmies.findIndex(
      a => a.location === provId && isRebelArmy(a) && !a.destination
    );

    if (rebelArmyIndex !== -1) {
      const rebelArmy = { ...updatedArmies[rebelArmyIndex] };
      const infantryIndex = rebelArmy.regiments.findIndex(r => r.type === 'infantry');

      if (infantryIndex !== -1) {
        const updatedRegiments = rebelArmy.regiments.map(r => ({ ...r }));
        updatedRegiments[infantryIndex].strength += REBEL_ACCUMULATION_RATE;
        rebelArmy.regiments = updatedRegiments;
      } else {
        const newReg = createRegiment('infantry');
        newReg.strength = REBEL_ACCUMULATION_RATE;
        rebelArmy.regiments = [...rebelArmy.regiments, newReg];
      }

      const totalTroops = getArmyTotalTroops(rebelArmy);
      console.log(`🔥 Rebeldes em ${province.name} acumularam +${REBEL_ACCUMULATION_RATE} (total: ${totalTroops})`);

      if (totalTroops >= SEPARATIST_THRESHOLD && !rebelArmy.separatistMode) {
        rebelArmy.separatistMode = true;
        const countryName = getCountryByTag(rebelArmy.originalOwner || '')?.name || 'país desconhecido';
        notifications.push(`⚠️ Exército Separatista atingiu 5.000 tropas e iniciou a marcha de reconquista!`);
        logs.push(`⚔️ Rebeldes de ${countryName} atingiram 5k e estão atacando para reconquistar seus territórios originais!`);
        console.log(`⚔️ Rebeldes de ${countryName} atingiram 5k e estão atacando para reconquistar seus territórios originais!`);
      }

      updatedArmies[rebelArmyIndex] = rebelArmy;
    } else {
      const originalOwner = province.originalOwner || province.owner;
      const countryName = getCountryByTag(originalOwner)?.name || province.name;

      const newRebelArmy: Army = {
        id: generateRebelArmyId(),
        owner: `rebel_${provId}`,
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
        originalOwner,
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
 * BFS apenas por território histórico (originalOwner)
 */
function findSeparatistPath(
  startId: string,
  targetId: string,
  provinces: Province[],
  rebelOriginalOwner: string
): string[] {
  if (startId === targetId) return [];

  const visited = new Set<string>([startId]);
  const parent = new Map<string, string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) {
      const path: string[] = [];
      let node: string | undefined = targetId;
      while (node !== startId) {
        path.unshift(node!);
        node = parent.get(node!);
      }
      return path;
    }

    const currentProv = provinces.find(p => p.id === current);
    if (!currentProv) continue;

    for (const neighbor of currentProv.neighbors || []) {
      if (visited.has(neighbor)) continue;
      const neighborProv = provinces.find(p => p.id === neighbor);
      if (!neighborProv) continue;
      if (neighborProv.originalOwner !== rebelOriginalOwner) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return [];
}

/**
 * BFS livre (usado APENAS para rebeldes perdidos voltarem para casa)
 */
function findWayHomePath(
  startId: string,
  targetId: string,
  provinces: Province[]
): string[] {
  if (startId === targetId) return [];
  const visited = new Set<string>([startId]);
  const parent = new Map<string, string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) {
      const path: string[] = [];
      let node: string | undefined = targetId;
      while (node !== startId) {
        path.unshift(node!);
        node = parent.get(node!);
      }
      return path;
    }
    const currentProv = provinces.find(p => p.id === current);
    if (!currentProv) continue;
    for (const neighbor of currentProv.neighbors || []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return [];
}

/**
 * Movimento separatista (ignora diplomacia)
 * allowHome = true permite entrar em província do próprio país (trânsito/volta)
 */
function moveSeparatistArmy(
  army: Army,
  targetId: string,
  provinces: Province[],
  allowHome = false
): Army | null {
  const currentProvince = provinces.find(p => p.id === army.location);
  if (!currentProvince) return null;
  if (!currentProvince.neighbors.includes(targetId)) return null;

  const targetProvince = provinces.find(p => p.id === targetId);
  if (!targetProvince) return null;

  if (!allowHome && targetProvince.owner === army.originalOwner) return null;

  return {
    ...army,
    destination: targetId,
    targetDestination: targetId,
    path: [targetId],
    movementProgress: 0,
  };
}

/**
 * Funde exércitos rebeldes do MESMO país original na MESMA província
 * (evita dois marcadores rebeldes no mesmo lugar)
 */
function mergeRebelArmies(armies: Army[]): Army[] {
  const result: Army[] = [];

  for (const army of armies) {
    if (!isRebelArmy(army) || !army.location) {
      result.push(army);
      continue;
    }

    const idx = result.findIndex(
      a => isRebelArmy(a) &&
           a.location === army.location &&
           a.originalOwner === army.originalOwner
    );

    if (idx !== -1) {
      const target = { ...result[idx] };
      const regiments = target.regiments.map(r => ({ ...r }));
      for (const reg of army.regiments) {
        const existing = regiments.find(r => r.type === reg.type);
        if (existing) {
          existing.strength += reg.strength;
        } else {
          regiments.push({ ...reg });
        }
      }
      target.regiments = regiments;
      target.separatistMode = target.separatistMode || army.separatistMode;
      result[idx] = target;
      console.log(`🔀 Rebeldes de ${army.originalOwner} fundidos em ${army.location} (${getArmyTotalTroops(target)} tropas)`);
    } else {
      result.push({ ...army });
    }
  }

  return result;
}

/**
 * Quando a reconquista termina, o rebelde vira exército nacional
 * (mesma bandeira, funde com o exército do país → 1 marcador só)
 */
function integrateLiberatedRebels(armies: Army[], provinces: Province[]): Army[] {
  return armies.map(army => {
    if (!isRebelArmy(army) || !army.separatistMode || !army.originalOwner) return army;

    const occupiedHome = provinces.some(
      p => p.originalOwner === army.originalOwner && p.owner !== army.originalOwner
    );

    if (!occupiedHome) {
      console.log(`🏳️ ${army.name}: reconquista completa! Integrado ao exército de ${army.originalOwner}`);
      return {
        ...army,
        owner: army.originalOwner,
        separatistMode: false,
        name: `Exército Libertador (${army.originalOwner})`,
      };
    }
    return army;
  });
}

/**
 * ============================================================
 * IA SEPARATISTA - MARCHA RESTRITA (VERSÃO FINAL)
 * ============================================================
 * SÓ ataca províncias com originalOwner dele que estão ocupadas.
 * Nunca entra em território estrangeiro.
 */
export function processSeparatistAI(
  armies: Army[],
  provinces: Province[]
): Army[] {
  let updatedArmies = mergeRebelArmies([...armies]);
  updatedArmies = integrateLiberatedRebels(updatedArmies, provinces);

  const separatistArmies = updatedArmies.filter(
    a => isRebelArmy(a) && a.separatistMode === true
  );

  if (separatistArmies.length > 0) {
    console.log(`🎯 processSeparatistAI: processando ${separatistArmies.length} exército(s) separatista(s)`);
  }

  for (const army of separatistArmies) {
    if (!army.location || army.destination || army.inCombat) continue;

    const currentProvince = provinces.find(p => p.id === army.location);
    if (!currentProvince) continue;

    const originalOwner = army.originalOwner || currentProvince.owner;

    // ========================================
    // 🎯 ESTRATÉGIA 1: Atacar vizinho = território histórico ocupado
    // ========================================
    const historicNeighborTargets = (currentProvince.neighbors || []).filter(neighborId => {
      const neighborProv = provinces.find(p => p.id === neighborId);
      if (!neighborProv) return false;
      return (
        neighborProv.originalOwner === originalOwner &&
        neighborProv.owner !== originalOwner
      );
    });

    if (historicNeighborTargets.length > 0) {
      const targetId = historicNeighborTargets[0];
      const movedArmy = moveSeparatistArmy(army, targetId, provinces);
      if (movedArmy) {
        const idx = updatedArmies.findIndex(a => a.id === army.id);
        if (idx !== -1) {
          updatedArmies[idx] = movedArmy;
          const targetProv = provinces.find(p => p.id === targetId);
          console.log(`⚔️ ${army.name} ATACA ${targetProv?.name} (território histórico)!`);
        }
        continue;
      }
    }

    // ========================================
    // 🎯 ESTRATÉGIA 2: Trânsito por território próprio/libertado
    // ========================================
    const transitNeighbors = (currentProvince.neighbors || []).filter(neighborId => {
      const neighborProv = provinces.find(p => p.id === neighborId);
      if (!neighborProv) return false;
      return (
        neighborProv.originalOwner === originalOwner &&
        neighborProv.owner === originalOwner
      );
    });

    let moved = false;
    for (const transitId of transitNeighbors) {
      const transitProv = provinces.find(p => p.id === transitId)!;
      const furtherTargets = (transitProv.neighbors || []).filter(nid => {
        const p = provinces.find(x => x.id === nid);
        return (
          p &&
          p.originalOwner === originalOwner &&
          p.owner !== originalOwner
        );
      });

      if (furtherTargets.length > 0) {
        const movedArmy = moveSeparatistArmy(army, transitId, provinces, true);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = movedArmy;
            console.log(`🚶 ${army.name} transitando por ${transitProv.name}`);
          }
          moved = true;
          break;
        }
      }
    }
    if (moved) continue;

    // ========================================
    // 🎯 ESTRATÉGIA 3: Pathfinding até alvo histórico remoto
    // ========================================
    const remoteHistoricTargets = provinces.filter(p =>
      p.originalOwner === originalOwner &&
      p.owner !== originalOwner
    );

    if (remoteHistoricTargets.length > 0) {
      let bestTarget: Province | null = null;
      let bestPath: string[] = [];

      for (const target of remoteHistoricTargets) {
        const path = findSeparatistPath(army.location, target.id, provinces, originalOwner);
        if (path.length > 0 && (bestPath.length === 0 || path.length < bestPath.length)) {
          bestTarget = target;
          bestPath = path;
        }
      }

      if (bestTarget && bestPath.length > 0) {
        const nextStepId = bestPath[0];
        const isHomeStep = provinces.find(p => p.id === nextStepId)?.owner === originalOwner;
        const movedArmy = moveSeparatistArmy(army, nextStepId, provinces, isHomeStep);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = {
              ...movedArmy,
              path: bestPath,
              targetDestination: bestTarget.id,
            };
            console.log(`🚶 ${army.name} marchando para ${bestTarget.name} (rota histórica: ${bestPath.length})`);
          }
          continue;
        }
      }
    }

    // ========================================
    // 🏠 ESTRATÉGIA 4: Rebelde perdido em terra estrangeira → voltar para casa
    // ========================================
    if (currentProvince.originalOwner !== originalOwner) {
      const homeNeighbors = (currentProvince.neighbors || []).filter(neighborId => {
        const neighborProv = provinces.find(p => p.id === neighborId);
        return neighborProv?.originalOwner === originalOwner;
      });

      if (homeNeighbors.length > 0) {
        const movedArmy = moveSeparatistArmy(army, homeNeighbors[0], provinces, true);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = movedArmy;
            console.log(`🏠 ${army.name} voltando para casa`);
          }
          continue;
        }
      }

      // Pathfinding livre até a província natal mais próxima
      const homeProvinces = provinces.filter(p => p.originalOwner === originalOwner);
      let bestHome: Province | null = null;
      let bestHomePath: string[] = [];
      for (const home of homeProvinces) {
        const path = findWayHomePath(army.location, home.id, provinces);
        if (path.length > 0 && (bestHomePath.length === 0 || path.length < bestHomePath.length)) {
          bestHome = home;
          bestHomePath = path;
        }
      }
      if (bestHome && bestHomePath.length > 0) {
        const nextStepId = bestHomePath[0];
        const nextProv = provinces.find(p => p.id === nextStepId);
        const allowHome = nextProv?.owner === originalOwner;
        const movedArmy = moveSeparatistArmy(army, nextStepId, provinces, allowHome);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = movedArmy;
            console.log(`🏠 ${army.name} retornando para ${bestHome.name}`);
          }
          continue;
        }
      }
    }

    console.log(`🛡️ ${army.name}: aguardando em ${currentProvince.name} (nenhum território histórico ocupado)`);
  }

  return updatedArmies;
}

/**
 * Devolução de território quando rebelde vence
 */
export function checkRebelTerritoryReturn(winnerArmy: Army): string | null {
  if (isRebelArmy(winnerArmy) && winnerArmy.originalOwner) {
    return winnerArmy.originalOwner;
  }
  return null;
}