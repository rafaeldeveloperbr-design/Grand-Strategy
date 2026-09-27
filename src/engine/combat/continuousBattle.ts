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

  //console.log('⚔️ checkAllProvinceCombats: verificando', provinces.length, 'províncias');

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

  //console.log('⚔️ checkAllProvinceCombats:', newBattles.length, 'novas batalhas iniciadas');
  if (reinforcementsAdded.length > 0) {
    //console.log('⚔️ checkAllProvinceCombats:', reinforcementsAdded.length, 'reforços adicionados');
  }

  return { armies: updatedArmies, newBattles, updatedBattles, reinforcementsAdded };
}


/**
 * Inicia uma nova batalha contínua com duração proporcional ao menor exército (1000 tropas = 1 dia)
 */
export function startContinuousBattle(
  attackerArmies: Army[],
  defenderArmies: Army[],
  province: Province,
  currentDate: GameDate,
  battleId: string
): ActiveBattle {
  // Calcula tropas totais de cada lado no início
  const attackerTroops = attackerArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const defenderTroops = defenderArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);

  // 1. Duração baseada no MENOR exército (1000 tropas = 1 dia de batalha)
  const smallerArmyTroops = Math.min(attackerTroops, defenderTroops);
  const battleDays = Math.max(1, Math.floor(smallerArmyTroops / 1000));

  // Coleta todos os IDs de exércitos participantes
  const participantArmyIds = [
    ...attackerArmies.map(a => a.id),
    ...defenderArmies.map(a => a.id)
  ];

  console.log(`⚔️ Iniciando batalha contínua em ${province.name}: ${battleDays} dias`);
  console.log(`   Atacantes: ${attackerArmies.length} exércitos, ${attackerTroops} tropas`);
  console.log(`   Defensores: ${defenderArmies.length} exércitos, ${defenderTroops} tropas`);

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
    attackerArmyId: attackerArmies[0].id,
    defenderArmyId: defenderArmies[0].id,
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



export function addReinforcementsToBattle(
  battle: ActiveBattle,
  reinforcementArmy: Army,
  side: 'attacker' | 'defender',
  province: Province
): ActiveBattle {
  const reinforcementTroops = calculateArmySize(reinforcementArmy);
  const updatedBattle = { ...battle, participantArmyIds: [...battle.participantArmyIds] } as any;

  if (side === 'attacker') {
    updatedBattle.attackerCurrentTroops += reinforcementTroops;
  } else {
    updatedBattle.defenderCurrentTroops += reinforcementTroops;
  }

  if (!updatedBattle.participantArmyIds.includes(reinforcementArmy.id)) {
    updatedBattle.participantArmyIds.push(reinforcementArmy.id);
  }

  // marca dia que entrou
  updatedBattle.reinforcementEntryDay = updatedBattle.reinforcementEntryDay || {};
  updatedBattle.reinforcementEntryDay[reinforcementArmy.id] = battle.daysTotal - battle.daysRemaining;

  return updatedBattle;
}

export function processDailyBattle(
  battle: ActiveBattle,
  attacker: Army,
  defender: Army,
  province: Province
) {
  const daysRemaining = battle.daysRemaining - 1;

  const totalTroops = battle.attackerCurrentTroops + battle.defenderCurrentTroops;
  const attackerRatio = battle.attackerCurrentTroops / Math.max(1, totalTroops);
  const defenderRatio = battle.defenderCurrentTroops / Math.max(1, totalTroops);

  const baseLossRate = 0.06;
  const dailyAttackerLoss = Math.floor(
    battle.attackerCurrentTroops * baseLossRate * (0.5 + defenderRatio)
  );
  const dailyDefenderLoss = Math.floor(
    battle.defenderCurrentTroops * baseLossRate * (0.5 + attackerRatio)
  );

  // CORREÇÃO: se tem reforço, o dano vai mais pro exército velho
  const hasReinf = (battle as any).reinforcementEntryDay && Object.keys((battle as any).reinforcementEntryDay).length > 0;

  let attackerDailyForMain = dailyAttackerLoss;
  let defenderDailyForMain = dailyDefenderLoss;

  if (hasReinf) {
    // 70% do dano fica no exército que já tava lutando, 30% pros reforços (que não estão nesse tick ainda)
    // então o main toma 70%
    attackerDailyForMain = Math.floor(dailyAttackerLoss * 0.7);
    defenderDailyForMain = Math.floor(dailyDefenderLoss * 0.7);
  }

  const updatedAttacker = applyTroopLoss(attacker, attackerDailyForMain);
  const updatedDefender = applyTroopLoss(defender, defenderDailyForMain);

  const attackerCurrentTroops = Math.max(0, battle.attackerCurrentTroops - dailyAttackerLoss);
  const defenderCurrentTroops = Math.max(0, battle.defenderCurrentTroops - dailyDefenderLoss);

  const attackerShouldRetreat = attackerCurrentTroops > 0 && attackerCurrentTroops <= 1000;
  const defenderShouldRetreat = defenderCurrentTroops > 0 && defenderCurrentTroops <= 1000;

  const finished =
    daysRemaining <= 0 ||
    attackerCurrentTroops <= 0 ||
    defenderCurrentTroops <= 0 ||
    attackerShouldRetreat ||
    defenderShouldRetreat;

  return {
    battle: {
    ...battle,
      daysRemaining,
      attackerCasualties: battle.attackerCasualties + dailyAttackerLoss,
      defenderCasualties: battle.defenderCasualties + dailyDefenderLoss,
      attackerCurrentTroops,
      defenderCurrentTroops,
      shouldRetreatAttacker: attackerShouldRetreat,
      shouldRetreatDefender: defenderShouldRetreat,
      // salva quanto o reforço deve perder depois (30%)
      pendingReinforcementLoss: hasReinf? {
        attacker: dailyAttackerLoss - attackerDailyForMain,
        defender: dailyDefenderLoss - defenderDailyForMain,
      } : null,
    } as any,
    attacker: updatedAttacker,
    defender: updatedDefender,
    finished,
  };
}

/**
 * Função auxiliar que configura o recuo automático das tropas para fora do território inimigo
 */
function triggerRetreat(army: Army, currentProvince: Province) {
  army.inCombat = false;
  // Recua para o território de origem ou para a capital
  army.destination = army.owner;
  army.targetDestination = army.owner;
  army.path = [army.owner];
}