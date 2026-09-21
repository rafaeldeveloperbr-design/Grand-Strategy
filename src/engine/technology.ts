/**
 * ============================================================
 * MÓDULO 6 - Motor de Tecnologias e Focos Nacionais
 * ============================================================
 */

import { Country, Province } from '../types';
import { NationalFocus, Technology, CountryTechState, RewardEffect } from '../types/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technologies';

/**
 * Processa o progresso diário de focos e tecnologias de um país
 */
export function processDailyTechProgress(
  techState: CountryTechState,
  country: Country
): {
  techState: CountryTechState;
  notifications: string[];
} {
  const notifications: string[] = [];
  let updatedTechState = { ...techState };

  // Processa progresso do foco ativo
  if (updatedTechState.activeFocusId) {
    const focus = NATIONAL_FOCUSES.find(f => f.id === updatedTechState.activeFocusId);
    if (focus && !focus.completed) {
      const updatedFocus = { ...focus };
      updatedFocus.currentProgressDays += 1;

      if (updatedFocus.currentProgressDays >= updatedFocus.durationDays) {
        // Foco concluído
        updatedFocus.completed = true;
        updatedFocus.currentProgressDays = updatedFocus.durationDays;
        updatedTechState.completedFocuses = [...updatedTechState.completedFocuses, updatedFocus.id];
        updatedTechState.activeFocusId = null;
        notifications.push(`✅ Foco concluído: ${updatedFocus.title}`);
      }

      // Atualiza o foco no array global (necessário para persistência)
      const focusIndex = NATIONAL_FOCUSES.findIndex(f => f.id === updatedFocus.id);
      if (focusIndex !== -1) {
        NATIONAL_FOCUSES[focusIndex] = updatedFocus;
      }
    }
  }

  // Processa progresso da pesquisa ativa
  if (updatedTechState.activeResearchId) {
    const tech = TECHNOLOGIES.find(t => t.id === updatedTechState.activeResearchId);
    if (tech && !tech.researched) {
      // Verifica se tem ouro suficiente para continuar pesquisando
      const dailyCost = tech.costGold / tech.durationDays;
      if (country.resources.gold >= dailyCost) {
        const updatedTech = { ...tech };
        updatedTech.currentProgressDays += 1;

        if (updatedTech.currentProgressDays >= updatedTech.durationDays) {
          // Pesquisa concluída
          updatedTech.researched = true;
          updatedTech.currentProgressDays = updatedTech.durationDays;
          updatedTechState.completedTechnologies = [...updatedTechState.completedTechnologies, updatedTech.id];
          updatedTechState.activeResearchId = null;
          notifications.push(`🔬 Pesquisa concluída: ${updatedTech.title}`);
        }

        // Atualiza a tecnologia no array global
        const techIndex = TECHNOLOGIES.findIndex(t => t.id === updatedTech.id);
        if (techIndex !== -1) {
          TECHNOLOGIES[techIndex] = updatedTech;
        }
      }
    }
  }

  return { techState: updatedTechState, notifications };
}

/**
 * Inicia um foco nacional
 */
export function startNationalFocus(
  techState: CountryTechState,
  focusId: string
): CountryTechState | null {
  const focus = NATIONAL_FOCUSES.find(f => f.id === focusId);
  if (!focus || focus.completed) return null;

  // Verifica pré-requisitos
  if (focus.prerequisites) {
    const hasPrereqs = focus.prerequisites.every(prereqId => 
      techState.completedFocuses.includes(prereqId)
    );
    if (!hasPrereqs) return null;
  }

  return {
    ...techState,
    activeFocusId: focusId
  };
}

/**
 * Inicia uma pesquisa tecnológica
 */
export function startTechnologyResearch(
  techState: CountryTechState,
  techId: string,
  country: Country
): { techState: CountryTechState | null; cost: number } {
  const tech = TECHNOLOGIES.find(t => t.id === techId);
  if (!tech || tech.researched) return { techState: null, cost: 0 };

  // Verifica pré-requisitos
  const hasPrereqs = tech.prerequisites.every(prereqId => 
    techState.completedTechnologies.includes(prereqId)
  );
  if (!hasPrereqs) return { techState: null, cost: 0 };

  // Verifica se tem ouro suficiente
  if (country.resources.gold < tech.costGold) {
    return { techState: null, cost: tech.costGold };
  }

  return {
    techState: {
      ...techState,
      activeResearchId: techId
    },
    cost: tech.costGold
  };
}

/**
 * Calcula os bônus acumulados de todas as tecnologias e focos completados
 */
export function calculateTechBonuses(techState: CountryTechState): {
  combatPowerBonus: {
    infantry: number;
    cavalry: number;
    artillery: number;
  };
  goldIncomeMultiplier: number;
  buildCostMultiplier: number;
  buildTimeMultiplier: number;
  manpowerMultiplier: number;
} {
  const bonuses = {
    combatPowerBonus: {
      infantry: 0,
      cavalry: 0,
      artillery: 0
    },
    goldIncomeMultiplier: 1.0,
    buildCostMultiplier: 1.0,
    buildTimeMultiplier: 1.0,
    manpowerMultiplier: 1.0
  };

  // Processa focos completados
  for (const focusId of techState.completedFocuses) {
    const focus = NATIONAL_FOCUSES.find(f => f.id === focusId);
    if (focus) {
      applyRewardEffect(focus.rewardEffect, bonuses);
    }
  }

  // Processa tecnologias completadas
  for (const techId of techState.completedTechnologies) {
    const tech = TECHNOLOGIES.find(t => t.id === techId);
    if (tech) {
      applyRewardEffect(tech.rewardEffect, bonuses);
    }
  }

  return bonuses;
}

/**
 * Aplica um efeito de recompensa aos bônus acumulados
 */
function applyRewardEffect(
  effect: RewardEffect,
  bonuses: ReturnType<typeof calculateTechBonuses>
): void {
  switch (effect.type) {
    case 'COMBAT_POWER':
      if (effect.unitType === 'infantry') {
        bonuses.combatPowerBonus.infantry += effect.value;
      } else if (effect.unitType === 'cavalry') {
        bonuses.combatPowerBonus.cavalry += effect.value;
      } else if (effect.unitType === 'artillery') {
        bonuses.combatPowerBonus.artillery += effect.value;
      }
      break;
    case 'GOLD_INCOME':
      bonuses.goldIncomeMultiplier += effect.value;
      break;
    case 'BUILD_COST':
      bonuses.buildCostMultiplier += effect.value; // value é negativo
      break;
    case 'BUILD_TIME':
      bonuses.buildTimeMultiplier += effect.value; // value é negativo
      break;
    case 'MANPOWER':
      bonuses.manpowerMultiplier += effect.value;
      break;
  }
}

/**
 * Cria o estado inicial de tecnologias para um país
 */
export function createInitialTechState(countryTag: string): CountryTechState {
  return {
    countryTag,
    activeFocusId: null,
    activeResearchId: null,
    completedFocuses: [],
    completedTechnologies: []
  };
}
