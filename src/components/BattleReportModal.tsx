import React from 'react';
import { CombatResult, Country } from '../types';
import { formatArmySize } from '../utils/formatters';

interface BattleReportModalProps {
  battleResult: CombatResult;
  playerCountry: Country;
  allCountries: Country[];
  onClose: () => void;
}

export const BattleReportModal: React.FC<BattleReportModalProps> = ({
  battleResult,
  playerCountry,
  allCountries,
  onClose,
}) => {
  const {
    attackerOriginal,
    defenderOriginal,
    attacker,
    defender,
    winner,
    provinceName,
    duration,
    territoryChanged,
    newOwner,
  } = battleResult;

  const playerWon =
    (winner === 'attacker' && attackerOriginal.owner === playerCountry.tag) ||
    (winner === 'defender' && defenderOriginal.owner === playerCountry.tag);

  const attackerCountry = allCountries.find(c => c.tag === attackerOriginal.owner);
  const defenderCountry = allCountries.find(c => c.tag === defenderOriginal.owner);
  const newOwnerCountry = newOwner? allCountries.find(c => c.tag === newOwner) : null;

  const getRealSize = (army: any) => Math.floor(army.regiments.reduce((s: number, r: any) => s + r.strength, 0));

  const attackerInitialTroops = getRealSize(attackerOriginal);
  const defenderInitialTroops = getRealSize(defenderOriginal);
  let attackerSurvivors = getRealSize(attacker);
  let defenderSurvivors = getRealSize(defender);
  const isAttackerLoser = winner === 'defender';
  const isDefenderLoser = winner === 'attacker';
  if (isAttackerLoser && attackerSurvivors > 1000) attackerSurvivors = 1000;
  if (isDefenderLoser && defenderSurvivors > 1000) defenderSurvivors = 1000;

  const extra = battleResult as any;
  const attackerReinf = (extra.attackerReinfInitial as number) || 0;
  const reinfSizes = extra.reinforcementInitialSize as Record<string, number> | undefined;
  const totalReinfFromSizes = reinfSizes? (Object.keys(reinfSizes) as string[]).reduce((sum, key) => sum + (reinfSizes[key] || 0), 0) : 0;
  const defenderReinf = (extra.defenderReinfInitial as number) || (totalReinfFromSizes - attackerReinf) || 0;
  const totalAttackerInitial = (extra.totalAttackerInitial as number) || (attackerInitialTroops + attackerReinf);
  const totalDefenderInitial = (extra.totalDefenderInitial as number) || (defenderInitialTroops + defenderReinf) || 21000;
  const totalAttackerFinal = (extra.attackerCurrentTroops as number) || attackerSurvivors;
  const totalDefenderFinal = (extra.defenderCurrentTroops as number) || defenderSurvivors;
  const calculatedAttackerCasualties = Math.max(0, totalAttackerInitial - totalAttackerFinal);
  const calculatedDefenderCasualties = Math.max(0, totalDefenderInitial - totalDefenderFinal);

  const participantDetails = (extra.participantDetails as any[]) || [];
  const defenderDetails = participantDetails.filter(p => p.side === 'defender');
  const attackerDetails = participantDetails.filter(p => p.side === 'attacker');

  console.log('📊 BattleReportModal - CORRIGIDO:');
  console.log(` Atacante - Inicial: ${totalAttackerInitial}${attackerReinf > 0? ` (${attackerInitialTroops} + ${attackerReinf} reforço)` : ''}, Final: ${totalAttackerFinal}, Baixas: ${calculatedAttackerCasualties}`);
  console.log(` Defensor - Inicial: ${totalDefenderInitial}${defenderReinf > 0? ` (${defenderInitialTroops} + ${defenderReinf} reforço)` : ''}, Final: ${totalDefenderFinal}, Baixas: ${calculatedDefenderCasualties}`);
  if(defenderDetails.length > 0) console.log(' Detalhe defensor:', defenderDetails.map(d=> `${d.name}: ${d.initial}→${d.final} (-${d.loss})`).join(' | '));

  const getUnitBreakdown = (originalArmy: any, finalArmy: any) => {
    const breakdown: Record<string, { initial: number; final: number; lost: number }> = {};
    originalArmy.regiments.forEach((reg: any) => {
      if (!breakdown[reg.type]) breakdown[reg.type] = { initial: 0, final: 0, lost: 0 };
      breakdown[reg.type].initial += Math.floor(reg.strength);
    });
    finalArmy.regiments.forEach((reg: any) => {
      if (!breakdown[reg.type]) breakdown[reg.type] = { initial: 0, final: 0, lost: 0 };
      breakdown[reg.type].final += Math.floor(reg.strength);
    });
    if ((finalArmy.id === attacker.id && isAttackerLoser) || (finalArmy.id === defender.id && isDefenderLoser)) {
      const totalFinal = Object.values(breakdown).reduce((s, v) => s + v.final, 0);
      if (totalFinal > 1000) {
        const factor = 1000 / totalFinal;
        Object.keys(breakdown).forEach(type => { breakdown[type].final = Math.floor(breakdown[type].final * factor); });
      }
    }
    Object.keys(breakdown).forEach(type => { breakdown[type].lost = Math.floor(breakdown[type].initial - breakdown[type].final); });
    return breakdown;
  };

  const attackerBreakdown = getUnitBreakdown(attackerOriginal, attacker);
  const defenderBreakdown = getUnitBreakdown(defenderOriginal, defender);
  const getUnitIcon = (type: string) => type === 'infantry'? '🗡️' : type === 'cavalry'? '🐎' : '💣';
  const getUnitName = (type: string) => type === 'infantry'? 'Infantaria' : type === 'cavalry'? 'Cavalaria' : 'Artilharia';

  return (
    <div className="battle-report-overlay">
      <div className="battle-report-modal">
        <div className={`battle-report-header ${playerWon? 'victory' : 'defeat'}`}>
          <div className="battle-report-icon">{playerWon? '🏆' : '💀'}</div>
          <h2 className="battle-report-title">{playerWon? 'VITÓRIA!' : 'DERROTA'}</h2>
          <p className="battle-report-subtitle">Batalha de {provinceName}</p>
        </div>

        <div className="battle-report-info">
          <div className="battle-report-info-item"><span className="label">Duração:</span><span className="value">{duration} {duration === 1? 'dia' : 'dias'}</span></div>
          <div className="battle-report-info-item"><span className="label">Ratio:</span><span className="value">{battleResult.powerRatio.toFixed(2)}:1</span></div>
          {(attackerReinf > 0 || defenderReinf > 0) && (
            <div className="battle-report-info-item"><span className="label">⚔️ Reforços:</span><span className="value">{attackerReinf > 0? `ATQ +${attackerReinf} ` : ''}{defenderReinf > 0? `DEF +${defenderReinf}` : ''}</span></div>
          )}
        </div>

        <div className="battle-report-armies">
          <div className={`battle-report-army ${winner === 'attacker'? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{attackerCountry?.flag}</span><div className="army-info"><h3>{attackerCountry?.name}</h3><p>{attackerOriginal.name} {isAttackerLoser && '🏃 recuou com 1k'}</p></div>{winner === 'attacker' && <span className="winner-badge">VENCEDOR</span>}</div>
            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalAttackerInitial)} <small>({totalAttackerInitial})</small></span></div>
              {attackerDetails.length > 1 && (
                <div style={{fontSize:'0.8em', margin:'4px 0', color:'#aaa'}}>
                  {attackerDetails.map(d => (<div key={d.id}>- {d.name}: {d.initial} → {d.final} (-{d.loss})</div>))}
                </div>
              )}
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{formatArmySize(totalAttackerFinal)} <small>({totalAttackerFinal})</small></span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedAttackerCasualties)} <small>({calculatedAttackerCasualties})</small></span></div>
            </div>
          </div>

          <div className="battle-report-vs">VS</div>

          <div className={`battle-report-army ${winner === 'defender'? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{defenderCountry?.flag}</span><div className="army-info"><h3>{defenderCountry?.name}</h3><p>{defenderOriginal.name} {isDefenderLoser && '🏃 recuou com 1k'}</p></div>{winner === 'defender' && <span className="winner-badge">VENCEDOR</span>}</div>
            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalDefenderInitial)} <small>({totalDefenderInitial})</small></span></div>
              {defenderDetails.length > 0 && (
                <div style={{fontSize:'0.85em', margin:'6px 0', background:'rgba(0,0,0,0.2)', padding:'6px', borderRadius:'4px'}}>
                  {defenderDetails.map(d => (
                    <div key={d.id} style={{display:'flex', justifyContent:'space-between'}}>
                      <span>{d.name.includes('CHEAT')? 'CHEAT (reforço)' : d.name}:</span>
                      <span>{formatArmySize(d.initial)} → {formatArmySize(d.final)} <small style={{color:'#ff6666'}}>(-{formatArmySize(d.loss)})</small></span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid #555', marginTop:'4px', paddingTop:'4px', fontWeight:'bold', display:'flex', justifyContent:'space-between'}}>
                    <span>Total:</span>
                    <span>{formatArmySize(totalDefenderInitial)} → {formatArmySize(totalDefenderFinal)}</span>
                  </div>
                </div>
              )}
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{formatArmySize(totalDefenderFinal)} <small>({totalDefenderFinal})</small></span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedDefenderCasualties)} <small>({calculatedDefenderCasualties})</small></span></div>
            </div>
          </div>
        </div>

        <div className="battle-report-footer"><button className="battle-report-close-btn" onClick={onClose}>Continuar</button></div>
      </div>
    </div>
  );
};