/**
 * ============================================================
 * DEFINIÇÕES DE LEIS
 * ============================================================
 */

import { Law } from '../types/government';

export const LAWS: Record<string, Law> = {
  // === CONScription (Recrutamento) ===
  'conscription_peacetime': {
    id: 'conscription_peacetime',
    category: 'conscription',
    name: 'Recrutamento em Tempo de Paz',
    description: 'Recrutamento voluntário e limitado. Menor custo de manutenção, mas menos tropas disponíveis.',
    costGold: 0,
    bonuses: {
      manpowerMultiplier: 1.0,
      armyCostMultiplier: 1.0,
    },
  },
  'conscription_limited': {
    id: 'conscription_limited',
    category: 'conscription',
    name: 'Recrutamento Limitado',
    description: 'Aumenta o pool de recrutáveis e reduz custos de treinamento militar.',
    costGold: 1000,
    bonuses: {
      manpowerMultiplier: 1.25,
      armyCostMultiplier: 0.9,
    },
  },
  'conscription_total': {
    id: 'conscription_total',
    category: 'conscription',
    name: 'Recrutamento Total',
    description: 'Mobilização total da população. Máximo de tropas, mas custos elevados.',
    costGold: 3000,
    bonuses: {
      manpowerMultiplier: 1.75,
      armyCostMultiplier: 1.2,
    },
  },

  // === TAXATION (Tributação) ===
  'taxation_low': {
    id: 'taxation_low',
    category: 'taxation',
    name: 'Tributação Baixa',
    description: 'Impostos reduzidos para estimular o crescimento populacional e a felicidade.',
    costGold: 0,
    bonuses: {
      goldMultiplier: 0.8,
      popGrowthMultiplier: 1.2,
    },
  },
  'taxation_normal': {
    id: 'taxation_normal',
    category: 'taxation',
    name: 'Tributação Normal',
    description: 'Equilíbrio entre arrecadação e crescimento populacional.',
    costGold: 1500,
    bonuses: {
      goldMultiplier: 1.0,
      popGrowthMultiplier: 1.0,
    },
  },
  'taxation_high': {
    id: 'taxation_high',
    category: 'taxation',
    name: 'Tributação Alta',
    description: 'Impostos elevados para maximizar a arrecadação, mas reduz o crescimento populacional.',
    costGold: 4000,
    bonuses: {
      goldMultiplier: 1.4,
      popGrowthMultiplier: 0.8,
    },
  },

  // === GOVERNANCE (Governança) ===
  'governance_decentralized': {
    id: 'governance_decentralized',
    category: 'governance',
    name: 'Governança Descentralizada',
    description: 'Autonomia regional. Construção mais rápida, mas menos eficiente.',
    costGold: 0,
    bonuses: {
      buildTimeMultiplier: 0.85,
      goldMultiplier: 0.95,
    },
  },
  'governance_balanced': {
    id: 'governance_balanced',
    category: 'governance',
    name: 'Governança Balanceada',
    description: 'Equilíbrio entre eficiência central e autonomia local.',
    costGold: 2000,
    bonuses: {
      buildTimeMultiplier: 1.0,
      goldMultiplier: 1.0,
    },
  },
  'governance_centralized': {
    id: 'governance_centralized',
    category: 'governance',
    name: 'Governança Centralizada',
    description: 'Controle central forte. Maior eficiência econômica, mas construção mais lenta.',
    costGold: 5000,
    bonuses: {
      buildTimeMultiplier: 1.2,
      goldMultiplier: 1.15,
    },
  },
};

export const LAWS_BY_CATEGORY = {
  conscription: ['conscription_peacetime', 'conscription_limited', 'conscription_total'],
  taxation: ['taxation_low', 'taxation_normal', 'taxation_high'],
  governance: ['governance_decentralized', 'governance_balanced', 'governance_centralized'],
};

export const DEFAULT_LAWS = {
  conscription: 'conscription_peacetime',
  taxation: 'taxation_normal',
  governance: 'governance_balanced',
};
