/**
 * ============================================================
 * MÓDULO 1 - Barra Superior (Top Bar)
 * ============================================================
 * Exibe informações globais do país do jogador:
 * - Nome e bandeira do país
 * - Recursos (Ouro, Manpower)
 * - Estabilidade
 * - Data/Turno atual
 * - Controles de velocidade
 */

import React from 'react';
import { Country, GameDate } from '../types';

interface TopBarProps {
  playerCountry: Country;
  date: GameDate;
  gameSpeed: number;
  onSpeedChange: (speed: number) => void;
}

/**
 * Formata a data do jogo para exibição
 */
function formatDate(date: GameDate): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${date.day} de ${months[date.month - 1]}, ${date.year}`;
}

/**
 * Componente da barra superior do jogo
 */
export const TopBar: React.FC<TopBarProps> = ({
  playerCountry,
  date,
  gameSpeed,
  onSpeedChange,
}) => {
  const { resources } = playerCountry;

  return (
    <div className="top-bar">
      {/* === Seção: País do Jogador === */}
      <div className="top-bar__country">
        <span className="top-bar__flag">{playerCountry.flag}</span>
        <div className="top-bar__country-info">
          <span className="top-bar__country-name">{playerCountry.name}</span>
          <span className="top-bar__country-tag">[{playerCountry.tag}]</span>
        </div>
      </div>

      {/* === Seção: Recursos === */}
      <div className="top-bar__resources">
        {/* Ouro */}
        <div className="top-bar__resource" title="Ouro">
          <span className="top-bar__resource-icon">💰</span>
          <div className="top-bar__resource-data">
            <span className="top-bar__resource-value">
              {resources.gold.toLocaleString()}
            </span>
            <span className="top-bar__resource-label">Ouro</span>
          </div>
        </div>

        {/* Manpower */}
        <div className="top-bar__resource" title="Mão de Obra">
          <span className="top-bar__resource-icon">👥</span>
          <div className="top-bar__resource-data">
            <span className="top-bar__resource-value">
              {resources.manpower.toLocaleString()}
            </span>
            <span className="top-bar__resource-label">Manpower</span>
          </div>
        </div>

        {/* Estabilidade */}
        <div className="top-bar__resource" title="Estabilidade">
          <span className="top-bar__resource-icon">⚖️</span>
          <div className="top-bar__resource-data">
            <span className="top-bar__resource-value">{resources.stability}%</span>
            <span className="top-bar__resource-label">Estabilidade</span>
          </div>
        </div>

        {/* Prestígio */}
        <div className="top-bar__resource" title="Prestígio">
          <span className="top-bar__resource-icon">🏆</span>
          <div className="top-bar__resource-data">
            <span className="top-bar__resource-value">{resources.prestige}</span>
            <span className="top-bar__resource-label">Prestígio</span>
          </div>
        </div>
      </div>

      {/* === Seção: Data e Controles === */}
      <div className="top-bar__date-section">
        <div className="top-bar__date">{formatDate(date)}</div>
        <div className="top-bar__speed-controls">
          {[0, 1, 2, 3, 4, 5].map((speed) => (
            <button
              key={speed}
              className={`top-bar__speed-btn ${
                gameSpeed === speed ? 'top-bar__speed-btn--active' : ''
              }`}
              onClick={() => onSpeedChange(speed)}
              title={speed === 0 ? 'Pausar' : `Velocidade ${speed}`}
            >
              {speed === 0 ? '⏸' : `▶${speed}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
