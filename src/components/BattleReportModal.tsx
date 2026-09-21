import React from 'react';
import { CombatResult, Country } from '../types';

interface BattleReportModalProps {
  battleResult: CombatResult;
  playerCountry: Country;
  allCountries: Country[];
  onClose: () => void;
}

/**
 * Modal de Relatório de Pós-Batalha (AAR - After Action Report)
 */
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
    attackerCasualties,
    defenderCasualties,
    winner,
    provinceName,
    duration,
    territoryChanged,
    newOwner,
  } = battleResult;

  // Determina se o jogador venceu ou perdeu
  const playerWon = 
    (winner === 'attacker' && attackerOriginal.owner === playerCountry.tag) ||
    (winner === 'defender' && defenderOriginal.owner === playerCountry.tag);

  // Obtém informações dos países
  const attackerCountry = allCountries.find(c => c.tag === attackerOriginal.owner);
  const defenderCountry = allCountries.find(c => c.tag === defenderOriginal.owner);
  const newOwnerCountry = newOwner ? allCountries.find(c => c.tag === newOwner) : null;

  // Calcula tropas iniciais e sobreviventes
  const attackerInitialTroops = attackerOriginal.regiments.reduce((sum, r) => sum + r.strength, 0);
  const defenderInitialTroops = defenderOriginal.regiments.reduce((sum, r) => sum + r.strength, 0);
  const attackerSurvivors = attacker.regiments.reduce((sum, r) => sum + r.strength, 0);
  const defenderSurvivors = defender.regiments.reduce((sum, r) => sum + r.strength, 0);

  // Agrupa baixas por tipo de unidade
  const getUnitBreakdown = (originalArmy: typeof attackerOriginal, finalArmy: typeof attacker) => {
    const breakdown: Record<string, { initial: number; final: number; lost: number }> = {};
    
    originalArmy.regiments.forEach(reg => {
      if (!breakdown[reg.type]) {
        breakdown[reg.type] = { initial: 0, final: 0, lost: 0 };
      }
      breakdown[reg.type].initial += reg.strength;
    });

    finalArmy.regiments.forEach(reg => {
      if (!breakdown[reg.type]) {
        breakdown[reg.type] = { initial: 0, final: 0, lost: 0 };
      }
      breakdown[reg.type].final += reg.strength;
    });

    Object.keys(breakdown).forEach(type => {
      breakdown[type].lost = breakdown[type].initial - breakdown[type].final;
    });

    return breakdown;
  };

  const attackerBreakdown = getUnitBreakdown(attackerOriginal, attacker);
  const defenderBreakdown = getUnitBreakdown(defenderOriginal, defender);

  const getUnitIcon = (type: string) => {
    switch (type) {
      case 'infantry': return '🗡️';
      case 'cavalry': return '🐎';
      case 'artillery': return '💣';
      default: return '⚔️';
    }
  };

  const getUnitName = (type: string) => {
    switch (type) {
      case 'infantry': return 'Infantaria';
      case 'cavalry': return 'Cavalaria';
      case 'artillery': return 'Artilharia';
      default: return type;
    }
  };

  return (
    <div className="battle-report-overlay">
      <div className="battle-report-modal">
        {/* Cabeçalho */}
        <div className={`battle-report-header ${playerWon ? 'victory' : 'defeat'}`}>
          <div className="battle-report-icon">
            {playerWon ? '🏆' : '💀'}
          </div>
          <h2 className="battle-report-title">
            {playerWon ? 'VITÓRIA!' : 'DERROTA'}
          </h2>
          <p className="battle-report-subtitle">
            Batalha de {provinceName}
          </p>
        </div>

        {/* Informações da Batalha */}
        <div className="battle-report-info">
          <div className="battle-report-info-item">
            <span className="label">Duração:</span>
            <span className="value">{duration} {duration === 1 ? 'dia' : 'dias'}</span>
          </div>
          {territoryChanged && newOwnerCountry && (
            <div className="battle-report-info-item territory-change">
              <span className="label">Mudança Territorial:</span>
              <span className="value">
                Província capturada por {newOwnerCountry.flag} {newOwnerCountry.name}
              </span>
            </div>
          )}
        </div>

        {/* Comparativo de Exércitos */}
        <div className="battle-report-armies">
          {/* Atacante */}
          <div className={`battle-report-army ${winner === 'attacker' ? 'winner' : 'loser'}`}>
            <div className="army-header">
              <span className="army-flag">{attackerCountry?.flag}</span>
              <div className="army-info">
                <h3>{attackerCountry?.name}</h3>
                <p>{attackerOriginal.name}</p>
              </div>
              {winner === 'attacker' && <span className="winner-badge">VENCEDOR</span>}
            </div>
            
            <div className="army-stats">
              <div className="stat-row">
                <span className="stat-label">Tropas Iniciais:</span>
                <span className="stat-value">{attackerInitialTroops.toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Sobreviventes:</span>
                <span className="stat-value">{attackerSurvivors.toLocaleString()}</span>
              </div>
              <div className="stat-row casualties">
                <span className="stat-label">Baixas:</span>
                <span className="stat-value">{attackerCasualties.toLocaleString()}</span>
              </div>
            </div>

            {/* Detalhamento por unidade */}
            <div className="unit-breakdown">
              <h4>Composição de Forças</h4>
              {Object.entries(attackerBreakdown).map(([type, data]) => (
                <div key={type} className="unit-row">
                  <span className="unit-icon">{getUnitIcon(type)}</span>
                  <span className="unit-name">{getUnitName(type)}</span>
                  <div className="unit-stats">
                    <span className="initial">{data.initial}</span>
                    <span className="arrow">→</span>
                    <span className="final">{data.final}</span>
                    <span className="lost">(-{data.lost})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* VS */}
          <div className="battle-report-vs">VS</div>

          {/* Defensor */}
          <div className={`battle-report-army ${winner === 'defender' ? 'winner' : 'loser'}`}>
            <div className="army-header">
              <span className="army-flag">{defenderCountry?.flag}</span>
              <div className="army-info">
                <h3>{defenderCountry?.name}</h3>
                <p>{defenderOriginal.name}</p>
              </div>
              {winner === 'defender' && <span className="winner-badge">VENCEDOR</span>}
            </div>
            
            <div className="army-stats">
              <div className="stat-row">
                <span className="stat-label">Tropas Iniciais:</span>
                <span className="stat-value">{defenderInitialTroops.toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Sobreviventes:</span>
                <span className="stat-value">{defenderSurvivors.toLocaleString()}</span>
              </div>
              <div className="stat-row casualties">
                <span className="stat-label">Baixas:</span>
                <span className="stat-value">{defenderCasualties.toLocaleString()}</span>
              </div>
            </div>

            {/* Detalhamento por unidade */}
            <div className="unit-breakdown">
              <h4>Composição de Forças</h4>
              {Object.entries(defenderBreakdown).map(([type, data]) => (
                <div key={type} className="unit-row">
                  <span className="unit-icon">{getUnitIcon(type)}</span>
                  <span className="unit-name">{getUnitName(type)}</span>
                  <div className="unit-stats">
                    <span className="initial">{data.initial}</span>
                    <span className="arrow">→</span>
                    <span className="final">{data.final}</span>
                    <span className="lost">(-{data.lost})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botão de Fechar */}
        <div className="battle-report-footer">
          <button className="battle-report-close-btn" onClick={onClose}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
