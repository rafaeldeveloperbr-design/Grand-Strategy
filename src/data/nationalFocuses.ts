import { NationalFocus } from '../types/researchAndFocus';

export const NATIONAL_FOCUSES: NationalFocus[] = [
  // Focos Iniciais
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
      value: 0.15,
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
      value: 0.20
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
      value: -0.25
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
      value: 0.20,
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
      value: -0.30
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
      value: 0.15
    }
  },
  
  // Focos Militares
  {
    id: 'focus_army_modernization',
    title: 'Modernização do Exército',
    description: 'Reforma completa das forças armadas para aumentar a eficiência militar.',
    icon: '🎖️',
    durationDays: 80,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'MANPOWER',
      value: 200
    },
    prerequisites: ['focus_military_modernization']
  },
  {
    id: 'focus_border_fortification',
    title: 'Fortalecimento das Fronteiras',
    description: 'Investimento massivo em defesas de fronteira.',
    icon: '🏰',
    durationDays: 75,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.20
    },
    prerequisites: ['focus_fortification_program']
  },
  
  // Focos Econômicos
  {
    id: 'focus_agrarian_reform',
    title: 'Reforma Agrária',
    description: 'Redistribuição de terras para aumentar a produção agrícola.',
    icon: '🌾',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 100
    }
  },
  {
    id: 'focus_commercial_expansion',
    title: 'Expansão Comercial',
    description: 'Expansão agressiva das rotas comerciais e mercados.',
    icon: '📈',
    durationDays: 85,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.20
    },
    prerequisites: ['focus_economic_expansion']
  },
  {
    id: 'focus_manufacturing_incentive',
    title: 'Incentivo à Manufatura',
    description: 'Subsídios e incentivos para desenvolvimento industrial.',
    icon: '🏭',
    durationDays: 90,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.15
    },
    prerequisites: ['focus_commercial_expansion']
  },
  
  // Focos Políticos
  {
    id: 'focus_kingdom_centralization',
    title: 'Centralização do Reino',
    description: 'Consolidação do poder central para maior estabilidade e eficiência.',
    icon: '👑',
    durationDays: 80,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'STABILITY',
      value: 0.10
    }
  },
  {
    id: 'focus_scientific_patronage',
    title: 'Patronato Científico',
    description: 'Investimento em pesquisa e desenvolvimento científico.',
    icon: '🔬',
    durationDays: 75,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'RESEARCH_SPEED',
      value: 0.20
    },
    prerequisites: ['focus_kingdom_centralization']
  }
];