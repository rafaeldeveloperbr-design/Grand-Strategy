import { Army, Province, ActiveBattle, GameDate, CombatResult } from '../../types';
import { War } from '../../types/diplomacy';
import { COMBAT_BALANCE, applyTroopLoss, calculateArmySize } from './combatCalculations';


/**
 * Verifica automaticamente combates em todas as províncias
 * Inicia batalhas contínuas e processa reforços em batalhas existentes
 */
export function checkAllProvinceCombats(
  armies: Army[],
  provinces: Province[],
  wars: Array<{ attacker: string; defender: string }>,
  currentDate: GameDate,
  activeBattles: ActiveBattle[],
  techBonusesByCountry?: Map<string, { infantry: number; cavalry: number; artillery: number }>
): {
  armies: Army[];
  newBattles: ActiveBattle[];
  updatedBattles: ActiveBattle[];
  reinforcementsAdded: Array<{
    battleId: string;
    armyId: string;
    armyOwner: string;
    side: 'attacker' | 'defender';
    troops: number;
    provinceName: string;
  }>;
} {
  const updatedArmies = [...armies];
  const newBattles: ActiveBattle[] = [];
  const updatedBattles: ActiveBattle[] = [...activeBattles];
  const reinforcementsAdded: Array<{
    battleId: string;
    armyId: string;
    armyOwner: string;
    side: 'attacker' | 'defender';
    troops: number;
    provinceName: string;
  }> = [];

  console.log('⚔️ checkAllProvinceCombats: verificando', provinces.length, 'províncias');

  // Percorre todas as províncias
  for (const province of provinces) {
    // Verifica se já existe uma batalha ativa nesta província
    const existingBattleIndex = updatedBattles.findIndex(b => b.provinceId === province.id);
    const existingBattle = existingBattleIndex !== -1 ? updatedBattles[existingBattleIndex] : null;

    // Encontra todos os exércitos nesta província que NÃO estão em combate
    const armiesInProvince = updatedArmies.filter(a => a.location === province.id && !a.inCombat);

    if (armiesInProvince.length === 0) continue; // Nenhum exército livre

    // Se já existe uma batalha, processa reforços
    if (existingBattle) {
      console.log(`⚔️ Batalha existente em ${province.name} - verificando reforços`);
      
      // Obtém os países envolvidos na batalha
      const attackerArmy = updatedArmies.find(a => a.id === existingBattle.attackerArmyId);
      const defenderArmy = updatedArmies.find(a => a.id === existingBattle.defenderArmyId);
      
      if (!attackerArmy || !defenderArmy) {
        console.warn(`⚠️ Batalha ${existingBattle.id} sem exércitos válidos - removendo`);
        updatedBattles.splice(existingBattleIndex, 1);
        continue;
      }
      
      const attackerCountry = attackerArmy.owner;
      const defenderCountry = defenderArmy.owner;
      
      console.log(`   Lado Atacante: ${attackerCountry}`);
      console.log(`   Lado Defensor: ${defenderCountry}`);
      console.log(`   Exércitos livres na província: ${armiesInProvince.length}`);
      
      if (armiesInProvince.length > 0) {
        armiesInProvince.forEach(army => {
          console.log(`     - ${army.id} (${army.owner})`);
        });
      }
      
      // Verifica cada exército livre para determinar o lado correto
      for (const army of armiesInProvince) {
        let side: 'attacker' | 'defender' | null = null;
        
        // PRIORIDADE 1: Mesma tag do país do atacante original
        if (army.owner === attackerCountry) {
          side = 'attacker';
          console.log(`⚔️ REFORÇOS: Exército ${army.id} (${army.owner}) entrou no lado ATACANTE da batalha em ${province.name}!`);
        }
        // PRIORIDADE 2: Mesma tag do país do defensor original
        else if (army.owner === defenderCountry) {
          side = 'defender';
          console.log(`⚔️ REFORÇOS: Exército ${army.id} (${army.owner}) entrou no lado DEFENSOR da batalha em ${province.name}!`);
        }
        // PRIORIDADE 3: Aliado do atacante (em guerra com o defensor)
        else {
          const isAtWarWithDefender = wars.some(
            w => (w.attacker === army.owner && w.defender === defenderCountry) ||
                 (w.defender === army.owner && w.attacker === defenderCountry)
          );
          
          if (isAtWarWithDefender) {
            side = 'attacker';
            console.log(`⚔️ REFORÇOS: Exército ${army.id} (${army.owner}) entrou no lado ATACANTE (aliado) da batalha em ${province.name}!`);
          }
        }
        
        // Se determinou o lado, adiciona como reforço
        if (side !== null) {
          const reinforcementTroops = calculateArmySize(army);
          const updatedBattle = addReinforcementsToBattle(existingBattle, army, side, province);
          updatedBattles[existingBattleIndex] = updatedBattle;
          
          // Adiciona à lista de reforços
          reinforcementsAdded.push({
            battleId: existingBattle.id,
            armyId: army.id,
            armyOwner: army.owner,
            side: side,
            troops: reinforcementTroops,
            provinceName: province.name,
          });
          
          // Marca exército como em combate
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = { ...updatedArmies[idx], inCombat: true };
          }
        } else {
          // Exército não se qualifica para nenhum lado
          console.log(`   ⚠️ Exército ${army.id} (${army.owner}) não entrou na batalha - sem relação com os lados`);
        }
      }
      
      // Log de resumo após processar todos os reforços
      const battleReinforcements = reinforcementsAdded.filter(r => r.battleId === existingBattle.id);
      if (battleReinforcements.length > 0) {
        console.log(`   ✅ Total de reforços adicionados à batalha: ${battleReinforcements.length}`);
        battleReinforcements.forEach(r => {
          console.log(`      - ${r.armyOwner}: ${r.troops} tropas (lado ${r.side})`);
        });
      }
      
      continue; // Batalha existente processada, pula para próxima província
    }

    // Se não há batalha existente, verifica se pode iniciar uma nova
    if (armiesInProvince.length < 2) continue; // Precisa de pelo menos 2 exércitos

    // Agrupa exércitos por país
    const armiesByCountry = new Map<string, Army[]>();
    for (const army of armiesInProvince) {
      if (!armiesByCountry.has(army.owner)) {
        armiesByCountry.set(army.owner, []);
      }
      armiesByCountry.get(army.owner)!.push(army);
    }

    // Se há apenas um país na província, não há combate
    if (armiesByCountry.size < 2) continue;

    // Determina atacante e defensor(es)
    // Atacante = quem não é dono da província
    const provinceOwner = province.owner;
    let attackerCountry: string | null = null;
    let defenderCountry: string | null = null;

    for (const country of armiesByCountry.keys()) {
      if (country === provinceOwner) {
        defenderCountry = country;
      } else {
        // Verifica se está em guerra com o dono da província
        const isAtWar = wars.some(
          w => (w.attacker === country && w.defender === provinceOwner) ||
               (w.defender === country && w.attacker === provinceOwner)
        );
        
        if (isAtWar) {
          attackerCountry = country;
        }
      }
    }

    // Se não há atacante ou defensor válido, pula
    if (!attackerCountry || !defenderCountry) continue;

    const attackerArmies = armiesByCountry.get(attackerCountry) || [];
    const defenderArmies = armiesByCountry.get(defenderCountry) || [];

    if (attackerArmies.length === 0 || defenderArmies.length === 0) continue;

    console.log(`⚔️ Iniciando batalha contínua em ${province.name}: ${attackerCountry} vs ${defenderCountry}`);
    console.log(`   Atacantes: ${attackerArmies.length} exércitos (${attackerArmies.reduce((sum, a) => sum + calculateArmySize(a), 0)} tropas)`);
    console.log(`   Defensores: ${defenderArmies.length} exércitos (${defenderArmies.reduce((sum, a) => sum + calculateArmySize(a), 0)} tropas)`);

    // Inicia batalha contínua com TODOS os exércitos
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBattle = startContinuousBattle(attackerArmies, defenderArmies, province, currentDate, battleId);
    newBattles.push(newBattle);

    // Marca TODOS os exércitos envolvidos como em combate
    for (const army of attackerArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx !== -1) {
        updatedArmies[idx] = { ...updatedArmies[idx], inCombat: true };
      }
    }
    for (const army of defenderArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx !== -1) {
        updatedArmies[idx] = { ...updatedArmies[idx], inCombat: true };
      }
    }
  }

  console.log('⚔️ checkAllProvinceCombats:', newBattles.length, 'novas batalhas iniciadas');
  if (reinforcementsAdded.length > 0) {
    console.log('⚔️ checkAllProvinceCombats:', reinforcementsAdded.length, 'reforços adicionados');
  }

  return { armies: updatedArmies, newBattles, updatedBattles, reinforcementsAdded };
}

/**
 * Inicia uma nova batalha contínua (não resolve instantaneamente)
 * Aceita múltiplos exércitos de cada lado para incluir todos desde o Dia 1
 */
export function startContinuousBattle(
  attackerArmies: Army[],
  defenderArmies: Army[],
  province: Province,
  currentDate: GameDate,
  battleId: string
): ActiveBattle {
  // Calcula tropas totais de cada lado
  const attackerTroops = attackerArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const defenderTroops = defenderArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const totalTroops = attackerTroops + defenderTroops;
  
  // Calcula duração da batalha (2000 tropas = 1 dia)
  const battleDays = Math.max(1, Math.ceil(totalTroops / COMBAT_BALANCE.TROOPS_PER_BATTLE_DAY));

  // Coleta todos os IDs de exércitos participantes
  const participantArmyIds = [
    ...attackerArmies.map(a => a.id),
    ...defenderArmies.map(a => a.id)
  ];

  console.log(`⚔️ Iniciando batalha contínua em ${province.name}: ${battleDays} dias`);
  console.log(`   Atacantes: ${attackerArmies.length} exércitos, ${attackerTroops} tropas`);
  console.log(`   Defensores: ${defenderArmies.length} exércitos, ${defenderTroops} tropas`);
  console.log(`   Total de participantes: ${participantArmyIds.length} exércitos`);

  // Cria snapshots iniciais dos exércitos principais (ANTES do combate)
  const attackerInitialSnapshot: Army = {
    ...attackerArmies[0],
    regiments: attackerArmies[0].regiments.map(r => ({ ...r }))
  };
  
  const defenderInitialSnapshot: Army = {
    ...defenderArmies[0],
    regiments: defenderArmies[0].regiments.map(r => ({ ...r }))
  };

  return {
    id: battleId,
    provinceId: province.id,
    attackerArmyId: attackerArmies[0].id, // Mantém referência ao primeiro atacante
    defenderArmyId: defenderArmies[0].id, // Mantém referência ao primeiro defensor
    participantArmyIds: participantArmyIds,
    daysTotal: battleDays,
    daysRemaining: battleDays,
    attackerInitialTroops: attackerTroops,
    defenderInitialTroops: defenderTroops,
    attackerCurrentTroops: attackerTroops,
    defenderCurrentTroops: defenderTroops,
    attackerCasualties: 0,
    defenderCasualties: 0,
    startDate: currentDate,
    attackerInitialSnapshot,
    defenderInitialSnapshot,
  };
}

/**
 * Adiciona reforços a uma batalha existente
 * Recalcula a duração da batalha com base nas novas tropas
 */
export function addReinforcementsToBattle(
  battle: ActiveBattle,
  reinforcementArmy: Army,
  side: 'attacker' | 'defender',
  province: Province
): ActiveBattle {
  const reinforcementTroops = calculateArmySize(reinforcementArmy);
  
  console.log(`⚔️ REFORÇOS: Exército ${reinforcementArmy.id} (${reinforcementArmy.owner}) entrou na batalha em ${province.name}!`);
  console.log(`   Lado: ${side === 'attacker' ? 'Atacante' : 'Defensor'}`);
  console.log(`   Tropas adicionadas: ${reinforcementTroops}`);
  
  // Atualiza tropas do lado correspondente
  const updatedBattle = { ...battle };
  
  if (side === 'attacker') {
    updatedBattle.attackerCurrentTroops += reinforcementTroops;
    updatedBattle.attackerInitialTroops += reinforcementTroops;
  } else {
    updatedBattle.defenderCurrentTroops += reinforcementTroops;
    updatedBattle.defenderInitialTroops += reinforcementTroops;
  }
  
  // Adiciona o ID do reforço à lista de participantes
  if (!updatedBattle.participantArmyIds.includes(reinforcementArmy.id)) {
    updatedBattle.participantArmyIds = [...updatedBattle.participantArmyIds, reinforcementArmy.id];
    console.log(`   ✅ Exército ${reinforcementArmy.id} adicionado à lista de participantes`);
  }
  
  // Recalcula duração da batalha com base nas novas tropas totais
  const totalTroops = updatedBattle.attackerCurrentTroops + updatedBattle.defenderCurrentTroops;
  const additionalDays = Math.ceil(reinforcementTroops / COMBAT_BALANCE.TROOPS_PER_BATTLE_DAY);
  
  updatedBattle.daysTotal += additionalDays;
  updatedBattle.daysRemaining += additionalDays;
  
  console.log(`   Dias adicionais: ${additionalDays}`);
  console.log(`   Nova duração total: ${updatedBattle.daysTotal} dias`);
  console.log(`   Dias restantes: ${updatedBattle.daysRemaining}`);
  console.log(`   Total de participantes: ${updatedBattle.participantArmyIds.length} exércitos`);
  
  return updatedBattle;
}

/**
 * Processa um dia de batalha contínua
 * Aplica baixas diárias e reduz dias restantes
 */
export function processDailyBattle(
  battle: ActiveBattle,
  attacker: Army,
  defender: Army,
  province: Province
): {
  battle: ActiveBattle;
  attacker: Army;
  defender: Army;
  finished: boolean;
} {
  // Reduz dias restantes
  const daysRemaining = battle.daysRemaining - 1;
  
  // Calcula baixas diárias (distribuídas ao longo da batalha)
  const dailyAttackerLoss = Math.floor(battle.attackerInitialTroops / battle.daysTotal * 0.5);
  const dailyDefenderLoss = Math.floor(battle.defenderInitialTroops / battle.daysTotal * 0.5);
  
  // Aplica baixas
  const attackerCasualties = battle.attackerCasualties + dailyAttackerLoss;
  const defenderCasualties = battle.defenderCasualties + dailyDefenderLoss;
  
  const attackerCurrentTroops = Math.max(0, battle.attackerCurrentTroops - dailyAttackerLoss);
  const defenderCurrentTroops = Math.max(0, battle.defenderCurrentTroops - dailyDefenderLoss);
  
  // Atualiza exércitos com tropas reduzidas
  const updatedAttacker = applyTroopLoss(attacker, dailyAttackerLoss);
  const updatedDefender = applyTroopLoss(defender, dailyDefenderLoss);
  
  const updatedBattle: ActiveBattle = {
    ...battle,
    daysRemaining,
    attackerCasualties,
    defenderCasualties,
    attackerCurrentTroops,
    defenderCurrentTroops,
  };
  
  const finished = daysRemaining <= 0 || attackerCurrentTroops <= 0 || defenderCurrentTroops <= 0;
  
  console.log(`⚔️ Batalha ${battle.id}: Dia ${battle.daysTotal - daysRemaining}/${battle.daysTotal} - ${daysRemaining} dias restantes`);
  
  if (finished) {
    console.log(`✅ Batalha finalizada em ${province.name} após ${battle.daysTotal} dias`);
    console.log(`   Atacante: ${battle.attackerInitialTroops} → ${attackerCurrentTroops} (${attackerCasualties} baixas)`);
    console.log(`   Defensor: ${battle.defenderInitialTroops} → ${defenderCurrentTroops} (${defenderCasualties} baixas)`);
    console.log(`   Motivo: ${daysRemaining <= 0 ? 'Dias esgotados' : attackerCurrentTroops <= 0 ? 'Atacante destruído' : 'Defensor destruído'}`);
  }
  
  return {
    battle: updatedBattle,
    attacker: updatedAttacker,
    defender: updatedDefender,
    finished,
  };
}