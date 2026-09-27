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

  // CORREÇÃO: pega o tamanho real que está no mapa agora
  const getRealSize = (army: any) => Math.floor(army.regiments.reduce((s: number, r: any) => s + r.strength, 0));

  const attackerInitialTroops = getRealSize(attackerOriginal);
  const defenderInitialTroops = getRealSize(defenderOriginal);

  // Aqui já vem cortado pra 1k se for perdedor
  let attackerSurvivors = getRealSize(attacker);
  let defenderSurvivors = getRealSize(defender);

  // Se o vencedor é o defensor, o atacante é o perdedor que no seu print tem que ser 1k
  const isAttackerLoser = winner === 'defender';
  const isDefenderLoser = winner === 'attacker';

  // FORÇA 1k no visual se for perdedor (que é o que tá no mapa)
  // No seu caso da imagem: attacker (KHA) perdeu e tá com 1k em Steppe Magna
  if (isAttackerLoser && attackerSurvivors > 1000) {
    attackerSurvivors = 1000;
  }
  if (isDefenderLoser && defenderSurvivors > 1000) {
    defenderSurvivors = 1000;
  }

  const calculatedAttackerCasualties = Math.max(0, attackerInitialTroops - attackerSurvivors);
  const calculatedDefenderCasualties = Math.max(0, defenderInitialTroops - defenderSurvivors);

  console.log('📊 BattleReportModal - CORRIGIDO:');
  console.log(` Atacante - Inicial: ${attackerInitialTroops}, Final: ${attackerSurvivors}, Baixas: ${calculatedAttackerCasualties} ${isAttackerLoser? '(recuou com 1k pra capital)' : ''}`);
  console.log(` Defensor - Inicial: ${defenderInitialTroops}, Final: ${defenderSurvivors}, Baixas: ${calculatedDefenderCasualties} ${isDefenderLoser? '(recuou com 1k pra capital)' : ''}`);

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
    // Se for perdedor, força final pra 1k total proporcional
    if ((finalArmy.id === attacker.id && isAttackerLoser) || (finalArmy.id === defender.id && isDefenderLoser)) {
      const totalFinal = Object.values(breakdown).reduce((s, v) => s + v.final, 0);
      if (totalFinal > 1000) {
        const factor = 1000 / totalFinal;
        Object.keys(breakdown).forEach(type => {
          breakdown[type].final = Math.floor(breakdown[type].final * factor);
        });
      }
    }
    Object.keys(breakdown).forEach(type => {
      breakdown[type].lost = Math.floor(breakdown[type].initial - breakdown[type].final);
    });
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
          <p className="battle-report-subtitle">Batalha de {provinceName} - {isAttackerLoser || isDefenderLoser? 'Recuo com 1k para capital' : ''}</p>
        </div>

        <div className="battle-report-info">
          <div className="battle-report-info-item">
            <span className="label">Duração:</span>
            <span className="value">{duration} {duration === 1? 'dia' : 'dias'}</span>
          </div>
          <div className="battle-report-info-item">
            <span className="label">Ratio de Poder:</span>
            <span className="value">{battleResult.powerRatio.toFixed(2)}:1</span>
          </div>
          {battleResult.territorialDefenseBonus && (
            <div className="battle-report-info-item territorial-bonus">
              <span className="label">🏰 Bônus Territorial:</span>
              <span className="value">Defensor em território próprio</span>
            </div>
          )}
          {territoryChanged && newOwnerCountry && (
            <div className="battle-report-info-item territory-change">
              <span className="label">Mudança Territorial:</span>
              <span className="value">Província capturada por {newOwnerCountry.flag} {newOwnerCountry.name}</span>
            </div>
          )}
        </div>

        <div className="battle-report-armies">
          <div className={`battle-report-army ${winner === 'attacker'? 'winner' : 'loser'}`}>
            <div className="army-header">
              <span className="army-flag">{attackerCountry?.flag}</span>
              <div className="army-info">
                <h3>{attackerCountry?.name}</h3>
                <p>{attackerOriginal.name} {isAttackerLoser && '🏃 recuou com 1k'}</p>
              </div>
              {winner === 'attacker' && <span className="winner-badge">VENCEDOR</span>}
            </div>
            <div className="army-stats">
              <div className="stat-row">
                <span className="stat-label">Tropas Iniciais:</span>
                <span className="stat-value">{formatArmySize(attackerInitialTroops)} <small>({attackerInitialTroops})</small></span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Sobreviventes:</span>
                <span className="stat-value">{formatArmySize(attackerSurvivors)} <small>({attackerSurvivors})</small> {isAttackerLoser && <small style={{color: 'orange'}}>→ Capital</small>}</span>
              </div>
              <div className="stat-row casualties">
                <span className="stat-label">Baixas:</span>
                <span className="stat-value">{formatArmySize(calculatedAttackerCasualties)} <small>({calculatedAttackerCasualties})</small></span>
              </div>
            </div>
            <div className="unit-breakdown">
              <h4>Composição</h4>
              {Object.entries(attackerBreakdown).map(([type, data]) => (
                <div key={type} className="unit-row">
                  <span className="unit-icon">{getUnitIcon(type)}</span>
                  <span className="unit-name">{getUnitName(type)}</span>
                  <div className="unit-stats">
                    <span className="initial">{formatArmySize(data.initial)}</span>
                    <span className="arrow">→</span>
                    <span className="final">{formatArmySize(data.final)}</span>
                    <span className="lost">(-{formatArmySize(data.lost)})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="battle-report-vs">VS</div>

          <div className={`battle-report-army ${winner === 'defender'? 'winner' : 'loser'}`}>
            <div className="army-header">
              <span className="army-flag">{defenderCountry?.flag}</span>
              <div className="army-info">
                <h3>{defenderCountry?.name}</h3>
                <p>{defenderOriginal.name} {isDefenderLoser && '🏃 recuou com 1k'}</p>
              </div>
              {winner === 'defender' && <span className="winner-badge">VENCEDOR</span>}
            </div>
            <div className="army-stats">
              <div className="stat-row">
                <span className="stat-label">Tropas Iniciais:</span>
                <span className="stat-value">{formatArmySize(defenderInitialTroops)} <small>({defenderInitialTroops})</small></span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Sobreviventes:</span>
                <span className="stat-value">{formatArmySize(defenderSurvivors)} <small>({defenderSurvivors})</small> {isDefenderLoser && <small style={{color: 'orange'}}>→ Capital</small>}</span>
              </div>
              <div className="stat-row casualties">
                <span className="stat-label">Baixas:</span>
                <span className="stat-value">{formatArmySize(calculatedDefenderCasualties)} <small>({calculatedDefenderCasualties})</small></span>
              </div>
            </div>
            <div className="unit-breakdown">
              <h4>Composição</h4>
              {Object.entries(defenderBreakdown).map(([type, data]) => (
                <div key={type} className="unit-row">
                  <span className="unit-icon">{getUnitIcon(type)}</span>
                  <span className="unit-name">{getUnitName(type)}</span>
                  <div className="unit-stats">
                    <span className="initial">{formatArmySize(data.initial)}</span>
                    <span className="arrow">→</span>
                    <span className="final">{formatArmySize(data.final)}</span>
                    <span className="lost">(-{formatArmySize(data.lost)})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="battle-report-footer">
          <button className="battle-report-close-btn" onClick={onClose}>Continuar</button>
        </div>
      </div>
    </div>
  );
};