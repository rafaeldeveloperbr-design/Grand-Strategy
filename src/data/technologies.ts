/**
 * ============================================================
 * MÓDULO 6 - Dados de Tecnologias e Focos Nacionais
 * ============================================================
 */

import { NationalFocus, Technology } from '../types/technology';

/**
 * Focos Nacionais disponíveis
 */
export const NATIONAL_FOCUSES: NationalFocus[] = [
  {
    id: 'focus_military_modernization',
    title: 'Modernização Militar',
    description: 'Investir na modernização das forças armadas, aumentando o poder de combate da infantaria.',
    icon: '⚔️',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.15, // +15% poder de combate
      unitType: 'infantry'
    }
  },
  {
    id: 'focus_economic_expansion',
    title: 'Expansão Econômica',
    description: 'Focar no desenvolvimento econômico para aumentar a arrecadação de impostos.',
    icon: '💰',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.20 // +20% renda de ouro
    }
  },
  {
    id: 'focus_fortification_program',
    title: 'Programa de Fortificação',
    description: 'Investir em fortificações para reduzir o custo de construção de defesas.',
    icon: '🏰',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.25 // -25% custo de construção
    }
  },
  {
    id: 'focus_cavalry_traditions',
    title: 'Tradições de Cavalaria',
    description: 'Fortalecer as tradições de cavalaria, aumentando sua eficácia em combate.',
    icon: '🐎',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.20, // +20% poder de combate
      unitType: 'cavalry'
    },
    prerequisites: ['focus_military_modernization']
  },
  {
    id: 'focus_industrial_revolution',
    title: 'Revolução Industrial',
    description: 'Iniciar a industrialização para reduzir custos de construção.',
    icon: '🏭',
    durationDays: 100,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.30 // -30% tempo de construção
    },
    prerequisites: ['focus_economic_expansion']
  },
  {
    id: 'focus_national_unity',
    title: 'Unidade Nacional',
    description: 'Fortalecer a coesão nacional para aumentar a estabilidade e mão de obra.',
    icon: '🤝',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'MANPOWER',
      value: 0.15 // +15% mão de obra
    }
  }
];

/**
 * Tecnologias disponíveis
 */
export const TECHNOLOGIES: Technology[] = [
  // === TECNOLOGIAS MILITARES ===
  {
    id: 'tech_improved_weapons',
    title: 'Armas Melhoradas',
    description: 'Desenvolvimento de armas mais eficazes para a infantaria.',
    category: 'MILITARY',
    icon: '🗡️',
    costGold: 500,
    durationDays: 60,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.10, // +10% poder de infantaria
      unitType: 'infantry'
    }
  },
  {
    id: 'tech_cavalry_tactics',
    title: 'Táticas de Cavalaria',
    description: 'Novas táticas de combate montado para aumentar a eficácia da cavalaria.',
    category: 'MILITARY',
    icon: '🏇',
    costGold: 600,
    durationDays: 70,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_improved_weapons'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.15, // +15% poder de cavalaria
      unitType: 'cavalry'
    }
  },
  {
    id: 'tech_artillery_development',
    title: 'Desenvolvimento de Artilharia',
    description: 'Avanços na fabricação de canhões e artilharia de cerco.',
    category: 'MILITARY',
    icon: '💣',
    costGold: 800,
    durationDays: 90,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_improved_weapons'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.20, // +20% poder de artilharia
      unitType: 'artillery'
    }
  },
  
  // === TECNOLOGIAS ECONÔMICAS ===
  {
    id: 'tech_banking_system',
    title: 'Sistema Bancário',
    description: 'Implementação de um sistema bancário para aumentar a eficiência econômica.',
    category: 'ECONOMY',
    icon: '🏦',
    costGold: 400,
    durationDays: 50,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.10 // +10% renda de ouro
    }
  },
  {
    id: 'tech_trade_routes',
    title: 'Rotas Comerciais',
    description: 'Estabelecimento de rotas comerciais para aumentar o comércio.',
    category: 'ECONOMY',
    icon: '🚢',
    costGold: 600,
    durationDays: 70,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_banking_system'],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.15 // +15% renda de ouro
    }
  },
  {
    id: 'tech_tax_reform',
    title: 'Reforma Tributária',
    description: 'Reforma do sistema tributário para aumentar a arrecadação.',
    category: 'ECONOMY',
    icon: '📜',
    costGold: 500,
    durationDays: 60,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_banking_system'],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.12 // +12% renda de ouro
    }
  },
  
  // === TECNOLOGIAS DE INFRAESTRUTURA ===
  {
    id: 'tech_construction_techniques',
    title: 'Técnicas de Construção',
    description: 'Melhorias nas técnicas de construção para reduzir custos.',
    category: 'INFRASTRUCTURE',
    icon: '🔨',
    costGold: 450,
    durationDays: 55,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.15 // -15% custo de construção
    }
  },
  {
    id: 'tech_engineering_corps',
    title: 'Corpo de Engenheiros',
    description: 'Criação de um corpo especializado de engenheiros militares.',
    category: 'INFRASTRUCTURE',
    icon: '👷',
    costGold: 700,
    durationDays: 80,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_construction_techniques'],
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.20 // -20% tempo de construção
    }
  },
  {
    id: 'tech_fortification_design',
    title: 'Design de Fortificações',
    description: 'Avanços no design de fortificações para maior eficácia defensiva.',
    category: 'INFRASTRUCTURE',
    icon: '🏗️',
    costGold: 650,
    durationDays: 75,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_construction_techniques'],
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.20 // -20% custo de fortificações
    }
  }
];
