/**
 * ============================================================
 * MODAL DE CONFIGURAÇÕES
 * ============================================================
 * Permite ao jogador ajustar configurações do jogo, incluindo dificuldade da IA
 */

import React from 'react';
import { AIDifficulty } from '../types/difficulty';
import { DifficultySelector } from './DifficultySelector';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiDifficulty: AIDifficulty;
  onDifficultyChange: (difficulty: AIDifficulty) => void;
}

/**
 * Modal de configurações do jogo
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiDifficulty,
  onDifficultyChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal__header">
          <h2>⚙️ Configurações</h2>
          <button className="settings-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-modal__content">
          <DifficultySelector
            currentDifficulty={aiDifficulty}
            onDifficultyChange={onDifficultyChange}
          />
        </div>

        <div className="settings-modal__footer">
          <button className="settings-modal__btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
