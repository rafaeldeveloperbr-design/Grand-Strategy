import React, {useEffect} from 'react';
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
  } = battleResult;

  const playerWon =
    (winner === 'attacker' && attackerOriginal.owner === playerCountry.tag) ||
    (winner === 'defender' && defenderOriginal.owner === playerCountry.tag);

  const attackerCountry = allCountries.find(c => c.tag === attackerOriginal.owner);
  const defenderCountry = allCountries.find(c => c.tag === defenderOriginal.owner);

  const getRealSize = (army: any) => {
    if (!army.regiments || army.regiments.length === 0) return 0;
    return Math.floor(army.regiments.reduce((s: number, r: any) => s + r.strength, 0));
  };

  const extra = battleResult as any;
  const participantDetails = (extra.participantDetails as any[]) || [];
  const defenderDetails = participantDetails.filter(p => p.side === 'defender');
  const attackerDetails = participantDetails.filter(p => p.side === 'attacker');

  const isStackwipe = extra.isStackwipe as boolean;
  
  const totalAttackerInitial = (extra.totalAttackerInitial as number) || getRealSize(attackerOriginal);
  const totalDefenderInitial = (extra.totalDefenderInitial as number) || getRealSize(defenderOriginal);
  
  const totalAttackerFinal = attackerDetails.length > 0
    ? attackerDetails.reduce((s, d) => s + d.final, 0)
    : (extra.attackerCurrentTroops as number) || getRealSize(attacker);

  const totalDefenderFinal = defenderDetails.length > 0
    ? defenderDetails.reduce((s, d) => s + d.final, 0)
    : (extra.defenderCurrentTroops as number) || getRealSize(defender);

  const calculatedAttackerCasualties = Math.max(0, totalAttackerInitial - totalAttackerFinal);
  const calculatedDefenderCasualties = Math.max(0, totalDefenderInitial - totalDefenderFinal);

  const isAttackerLoser = winner === 'defender';
  const isDefenderLoser = winner === 'attacker';
  
  const attackerAnnihilated = isAttackerLoser && totalAttackerFinal === 0;
  const defenderAnnihilated = isDefenderLoser && totalDefenderFinal === 0;

  // --- CALCULO DO BONUS ---
  const prov = extra.province || extra.provinceData || {};
  const fortLevel = prov.fortLevel ?? prov.fort_level ?? extra.fortLevel ?? 0;
  const terrain = prov.terrain ?? prov.terrainType ?? extra.terrain ?? 'plains';
  const baseBonus = 5;
  const fortBonus = fortLevel * 5;
  const terrainBonus = terrain === 'mountain' ? 15 : terrain === 'hill' ? 10 : terrain === 'forest' ? 5 : 0;
  const totalBonus = Math.min(50, baseBonus + fortBonus + terrainBonus);
  const perDayLoss = Math.floor((totalDefenderInitial * (1 + totalBonus/100)) / Math.max(1, duration));

 useEffect(() => {
    console.log('📊 BattleReportModal - CORRIGIDO:');
    console.log(` Atacante - Inicial: ${totalAttackerInitial}, Final: ${totalAttackerFinal}, Baixas: ${calculatedAttackerCasualties} ${attackerAnnihilated? 'ANIQ' : ''}`);
    console.log(` Defensor - Inicial: ${totalDefenderInitial}, Final: ${totalDefenderFinal}, Baixas: ${calculatedDefenderCasualties} ${defenderAnnihilated? 'ANIQ' : ''} | Bonus: ${totalBonus}%`);
  }, [battleResult]);

  return (
    <div className="battle-report-overlay">
      <div className="battle-report-modal">
        <div className={`battle-report-header ${playerWon? 'victory' : 'defeat'}`}>
          <div className="battle-report-icon">{playerWon? '🏆' : '💀'}</div>
          <h2 className="battle-report-title">{playerWon? 'VITÓRIA!' : 'DERROTA'}</h2>
          <p className="battle-report-subtitle">Batalha de {provinceName}</p>
        </div>

        <div className="battle-report-info">
          <div className="battle-report-info-item"><span className="label">Duração:</span><span className="value">{duration} {duration === 1? 'dia' : 'dias'} (menor exército)</span></div>
          <div className="battle-report-info-item"><span className="label">Ratio:</span><span className="value">{battleResult.powerRatio.toFixed(2)}:1</span></div>
          {isStackwipe && <div className="battle-report-info-item"><span className="label" style={{color:'#ff4444'}}>💀 STACKWIPE!</span></div>}
        </div>

        <div className="battle-report-armies">
          <div className={`battle-report-army ${winner === 'attacker'? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{attackerCountry?.flag}</span><div className="army-info"><h3>{attackerCountry?.name}</h3><p>{attackerOriginal.name} {isAttackerLoser && (attackerAnnihilated ? '💀 ANIQUILADO' : '🏃 recuou com 1k')}</p></div>{winner === 'attacker' && <span className="winner-badge">VENCEDOR</span>}</div>
            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalAttackerInitial)} <small>({totalAttackerInitial})</small></span></div>
              {attackerDetails.length > 1 && (
                <div style={{fontSize:'0.8em', margin:'4px 0', color:'#aaa'}}>
                  {attackerDetails.map(d => (<div key={d.id}>- {d.name}: {d.initial} → {d.final} (-{d.loss}) {d.final === 0 && '💀'}</div>))}
                </div>
              )}
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{formatArmySize(totalAttackerFinal)} <small>({totalAttackerFinal})</small></span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedAttackerCasualties)} <small>({calculatedAttackerCasualties})</small></span></div>
            </div>
          </div>

          <div className="battle-report-vs">VS</div>

          <div className={`battle-report-army ${winner === 'defender'? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{defenderCountry?.flag}</span><div className="army-info"><h3>{defenderCountry?.name}</h3><p>{defenderOriginal.name} {isDefenderLoser && (defenderAnnihilated ? '💀 ANIQUILADO' : '🏃 recuou com 1k')}</p></div>{winner === 'defender' && <span className="winner-badge">VENCEDOR</span>}</div>
            
            {/* BÔNUS DENTRO DO DEFENSOR */}
            <div style={{background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:'6px', padding:'8px', margin:'8px 0'}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.85em'}}>
                <span>🛡️ Bônus Defesa:</span>
                <span style={{color:'#4ade80', fontWeight:'bold'}}>{totalBonus}%</span>
              </div>
              <div style={{fontSize:'0.75em', color:'#9ca3af', marginTop:'2px'}}>
                {baseBonus}% base + {fortBonus}% fort + {terrainBonus}% {terrain}
              </div>
              <div style={{fontSize:'0.75em', color:'#fb7185', marginTop:'4px', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'4px'}}>
                ⚔️ Lógica seca: {formatArmySize(totalDefenderInitial)} × {(1+totalBonus/100).toFixed(2)} ÷ {duration} = <b>{formatArmySize(perDayLoss)}/dia</b>
              </div>
            </div>

            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalDefenderInitial)} <small>({totalDefenderInitial})</small></span></div>
              {defenderDetails.length > 0 && (
                <div style={{fontSize:'0.85em', margin:'6px 0', background:'rgba(0,0,0,0.2)', padding:'6px', borderRadius:'4px'}}>
                  {defenderDetails.map(d => (
                    <div key={d.id} style={{display:'flex', justifyContent:'space-between'}}>
                      <span>{d.name.includes('CHEAT')? 'CHEAT (reforço)' : d.name}:</span>
                      <span>{formatArmySize(d.initial)} → {d.final === 0 ? '0 💀' : formatArmySize(d.final)} <small style={{color:'#ff6666'}}>(-{formatArmySize(d.loss)})</small></span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid #555', marginTop:'4px', paddingTop:'4px', fontWeight:'bold', display:'flex', justifyContent:'space-between'}}>
                    <span>Total:</span>
                    <span>{formatArmySize(totalDefenderInitial)} → {totalDefenderFinal === 0 ? '0 💀' : formatArmySize(totalDefenderFinal)}</span>
                  </div>
                </div>
              )}
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{defenderAnnihilated ? '0 💀' : `${formatArmySize(totalDefenderFinal)} (${totalDefenderFinal})`}</span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedDefenderCasualties)} <small>({calculatedDefenderCasualties})</small></span></div>
            </div>
          </div>
        </div>

        <div className="battle-report-footer"><button className="battle-report-close-btn" onClick={onClose}>Continuar</button></div>
      </div>
    </div>
  );
};