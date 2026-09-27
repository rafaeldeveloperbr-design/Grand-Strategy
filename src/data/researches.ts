import { ResearchItem } from '../types/researchAndFocus';

export const RESEARCH_ITEMS: ResearchItem[] = [
  // Pesquisas Militares
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
      value: 0.10,
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
      value: 0.15,
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
      value: 0.20,
      unitType: 'artillery'
    }
  },
  {
    id: 'tech_siege_artillery',
    title: 'Artilharia de Cerco Avançada',
    description: 'Desenvolvimento de artilharia especializada em derrubar fortificações.',
    category: 'MILITARY',
    icon: '🎯',
    costGold: 900,
    durationDays: 100,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_artillery_development'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.20,
      unitType: 'artillery'
    }
  },
  {
    id: 'tech_line_infantry_doctrine',
    title: 'Doutrina de Infantaria em Linha',
    description: 'Táticas de formação em linha para maximizar a defesa da infantaria.',
    category: 'MILITARY',
    icon: '🛡️',
    costGold: 700,
    durationDays: 80,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_improved_weapons'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.10,
      unitType: 'infantry'
    }
  },
  {
    id: 'tech_heavy_cavalry_tactics',
    title: 'Táticas de Cavalaria Pesada',
    description: 'Técnicas avançadas de combate para cavalaria pesada.',
    category: 'MILITARY',
    icon: '⚔️',
    costGold: 850,
    durationDays: 90,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_cavalry_tactics'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.15,
      unitType: 'cavalry'
    }
  },
  {
    id: 'tech_military_logistics',
    title: 'Logística Militar',
    description: 'Sistemas avançados de suprimentos para reduzir custos de manutenção.',
    category: 'MILITARY',
    icon: '📦',
    costGold: 1000,
    durationDays: 110,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_siege_artillery', 'tech_line_infantry_doctrine'],
    rewardEffect: {
      type: 'MANPOWER',
      value: -0.10
    }
  },

  // Pesquisas Econômicas
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
      value: 0.10
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
      value: 0.15
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
      value: 0.12
    }
  },
  {
    id: 'tech_mercantilism',
    title: 'Mercantilismo',
    description: 'Políticas econômicas para maximizar a eficiência de mercados e portos.',
    category: 'ECONOMY',
    icon: '💹',
    costGold: 800,
    durationDays: 85,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_trade_routes'],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.15
    }
  },
  {
    id: 'tech_pre_industrial_manufacturing',
    title: 'Manufatura Pré-Industrial',
    description: 'Técnicas de produção em massa para acelerar construções.',
    category: 'ECONOMY',
    icon: '🏭',
    costGold: 1100,
    durationDays: 120,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_mercantilism', 'tech_tax_reform'],
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.15
    }
  },

  // Pesquisas de Infraestrutura
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
      value: -0.15
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
      value: -0.20
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
      value: -0.20
    }
  },
  {
    id: 'tech_centralized_admin',
    title: 'Administração Centralizada',
    description: 'Sistema administrativo unificado para aumentar a estabilidade.',
    category: 'INFRASTRUCTURE',
    icon: '🏛️',
    costGold: 500,
    durationDays: 60,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'STABILITY',
      value: 0.05
    }
  },
  {
    id: 'tech_science_academy',
    title: 'Academia de Ciências',
    description: 'Instituição de pesquisa para acelerar o desenvolvimento tecnológico.',
    category: 'INFRASTRUCTURE',
    icon: '🔬',
    costGold: 750,
    durationDays: 90,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_centralized_admin'],
    rewardEffect: {
      type: 'RESEARCH_SPEED',
      value: 0.15
    }
  }
];