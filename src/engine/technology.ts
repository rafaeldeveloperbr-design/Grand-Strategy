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
  
  // Validação de segurança
  if (!techState || !country) {
    console.warn('processDailyTechProgress: techState ou country inválido');
    return { techState: techState || createInitialTechState('UNKNOWN'), notifications };
  }
  
  // Cria uma cópia profunda do estado para evitar mutações
  let updatedTechState = {
    ...techState,
    completedFocuses: [...(techState.completedFocuses || [])],
    completedTechnologies: [...(techState.completedTechnologies || [])]
  };

  // Processa progresso do foco ativo
  if (updatedTechState.activeFocusId) {
    const focusIndex = NATIONAL_FOCUSES?.findIndex(f => f?.id === updatedTechState.activeFocusId);
    
    if (focusIndex !== undefined && focusIndex !== -1) {
      const focus = NATIONAL_FOCUSES[focusIndex];
      
      if (focus && !focus.completed) {
        // Incrementa o progresso em +1 dia
        const newProgressDays = focus.currentProgressDays + 1;
        
        // Atualiza o foco no array global
        NATIONAL_FOCUSES[focusIndex] = {
          ...focus,
          currentProgressDays: newProgressDays
        };
        
        console.log(`📊 Foco "${focus.title}": ${newProgressDays}/${focus.durationDays} dias`);

        // Verifica se o foco foi concluído
        if (newProgressDays >= focus.durationDays) {
          // Marca como concluído
          NATIONAL_FOCUSES[focusIndex] = {
            ...focus,
            currentProgressDays: focus.durationDays,
            completed: true
          };
          
          // Atualiza o estado do país
          updatedTechState.completedFocuses = [...updatedTechState.completedFocuses, focus.id];
          updatedTechState.activeFocusId = null;
          
          notifications.push(`✅ Foco concluído: ${focus.title}`);
          console.log(`✅ Foco concluído: ${focus.title}`);
        }
      }
    }
  }

  // Processa progresso da pesquisa ativa
  if (updatedTechState.activeResearchId) {
    const techIndex = TECHNOLOGIES?.findIndex(t => t?.id === updatedTechState.activeResearchId);
    
    if (techIndex !== undefined && techIndex !== -1) {
      const tech = TECHNOLOGIES[techIndex];
      
      if (tech && !tech.researched) {
        // Verifica se tem ouro suficiente para continuar pesquisando
        const dailyCost = tech.costGold / tech.durationDays;
        
        if (country.resources?.gold >= dailyCost) {
          // Incrementa o progresso em +1 dia
          const newProgressDays = tech.currentProgressDays + 1;
          
          // Atualiza a tecnologia no array global
          TECHNOLOGIES[techIndex] = {
            ...tech,
            currentProgressDays: newProgressDays
          };
          
          console.log(`📊 Pesquisa "${tech.title}": ${newProgressDays}/${tech.durationDays} dias`);

          // Verifica se a pesquisa foi concluída
          if (newProgressDays >= tech.durationDays) {
            // Marca como pesquisada
            TECHNOLOGIES[techIndex] = {
              ...tech,
              currentProgressDays: tech.durationDays,
              researched: true
            };
            
            // Atualiza o estado do país
            updatedTechState.completedTechnologies = [...updatedTechState.completedTechnologies, tech.id];
            updatedTechState.activeResearchId = null;
            
            notifications.push(`🔬 Pesquisa concluída: ${tech.title}`);
            console.log(`🔬 Pesquisa concluída: ${tech.title}`);
          }
        } else {
          console.warn(`⚠️ Ouro insuficiente para continuar pesquisa "${tech.title}" (necessário: ${dailyCost}/dia)`);
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
  // Validação de segurança
  if (!techState || !focusId) {
    console.warn('startNationalFocus: techState ou focusId inválido');
    return null;
  }
  
  const focus = NATIONAL_FOCUSES?.find(f => f?.id === focusId);
  if (!focus || focus.completed) return null;

  // Verifica pré-requisitos
  if (focus.prerequisites) {
    const hasPrereqs = focus.prerequisites.every(prereqId => 
      techState.completedFocuses?.includes(prereqId)
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
  // Validação de segurança
  if (!techState || !techId || !country) {
    console.warn('startTechnologyResearch: techState, techId ou country inválido');
    return { techState: null, cost: 0 };
  }
  
  const tech = TECHNOLOGIES?.find(t => t?.id === techId);
  if (!tech || tech.researched) return { techState: null, cost: 0 };
  
  // Verifica pré-requisitos
  const hasPrereqs = tech.prerequisites?.every(prereqId => 
    techState.completedTechnologies?.includes(prereqId)
  ) ?? true;
  if (!hasPrereqs) return { techState: null, cost: 0 };
  
  // Verifica se tem ouro suficiente
  if (country.resources?.gold < tech.costGold) {
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
