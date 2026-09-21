import React from 'react';
import { CombatResult, Country } from '../types';

interface BattleHistoryModalProps {
  battleHistory: CombatResult[];
  allCountries: Country[];
  onClose: () => void;
  onViewBattle: (battle: CombatResult) => void;
}

/**
 * Modal de Histórico de Batalhas
 */
export const BattleHistoryModal: React.FC<BattleHistoryModalProps> = ({
  battleHistory,
  allCountries,
  onClose,
  onViewBattle,
}) => {
  const getCountryByTag = (tag: string): Country | undefined => {
    return allCountries.find(c => c.tag === tag);
  };

  const formatDate = (date: { year: number; month: number; day: number }): string => {
    return `${date.day}/${date.month}/${date.year}`;
  };

  return (
    <div className="battle-history-overlay">
      <div className="battle-history-modal">
        {/* Cabeçalho */}
        <div className="battle-history-header">
          <h2>📜 Histórico de Batalhas</h2>
          <button className="battle-history-close" onClick={onClose}>✕</button>
        </div>

        {/* Lista de Batalhas */}
        <div className="battle-history-content">
          {battleHistory.length === 0 ? (
            <div className="battle-history-empty">
              <p>Nenhuma batalha registrada ainda.</p>
              <p className="battle-history-empty-subtitle">
                As batalhas aparecerão aqui conforme ocorrem.
              </p>
            </div>
          ) : (
            <div className="battle-history-list">
              {battleHistory.map((battle, index) => {
                const attackerCountry = getCountryByTag(battle.attackerOriginal.owner);
                const defenderCountry = getCountryByTag(battle.defenderOriginal.owner);
                const playerWon = 
                  (battle.winner === 'attacker' && battle.attackerOriginal.owner === 'IMP') ||
                  (battle.winner === 'defender' && battle.defenderOriginal.owner === 'IMP');

                return (
                  <div
                    key={index}
                    className={`battle-history-item ${playerWon ? 'victory' : 'defeat'}`}
                    onClick={() => onViewBattle(battle)}
                  >
                    {/* Data e Local */}
                    <div className="battle-history-item-header">
                      <span className="battle-history-date">
                        📅 {formatDate(battle.date)}
                      </span>
                      <span className="battle-history-location">
                        📍 {battle.provinceName}
                      </span>
                    </div>

                    {/* Atacante vs Defensor */}
                    <div className="battle-history-item-body">
                      <div className="battle-history-army">
                        <span className="battle-history-flag">{attackerCountry?.flag}</span>
                        <span className="battle-history-name">{attackerCountry?.name}</span>
                        <span className="battle-history-casualties">
                          -{battle.attackerCasualties.toLocaleString()}
                        </span>
                      </div>

                      <div className="battle-history-vs">VS</div>

                      <div className="battle-history-army">
                        <span className="battle-history-flag">{defenderCountry?.flag}</span>
                        <span className="battle-history-name">{defenderCountry?.name}</span>
                        <span className="battle-history-casualties">
                          -{battle.defenderCasualties.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Resultado */}
                    <div className="battle-history-item-footer">
                      <span className={`battle-history-result ${playerWon ? 'victory' : 'defeat'}`}>
                        {playerWon ? '🏆 Vitória' : '💀 Derrota'}
                      </span>
                      <span className="battle-history-ratio">
                        Ratio: {battle.powerRatio.toFixed(2)}:1
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
