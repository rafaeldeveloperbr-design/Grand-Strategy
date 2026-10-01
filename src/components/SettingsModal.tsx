/**
 * ============================================================
 * MODAL DE CONFIGURAÇÕES
 * ============================================================
 */

import React from 'react';
import { AIDifficulty } from '../types/difficulty';
import { DifficultySelector } from './DifficultySelector';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiDifficulty: AIDifficulty;
  onDifficultyChange: (difficulty: AIDifficulty) => void;
  onManualSave: () => void;
  autoSaveEnabled: boolean;
  onToggleAutoSave: (v: boolean) => void;
  onNewGame: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiDifficulty,
  onDifficultyChange,
  onManualSave,
  autoSaveEnabled,
  onToggleAutoSave,
  onNewGame
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

          <div className="settings-modal__section">
            <h3>💾 Salvamento</h3>
            
            <div className="settings-modal__save-actions">
              <button className="settings-modal__btn settings-modal__btn--primary" onClick={onManualSave}>
                💾 Salvar Agora
              </button>
              <span className="settings-modal__hint">Salva no navegador</span>
            </div>

            <label className="settings-modal__toggle">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => onToggleAutoSave(e.target.checked)}
              />
              <span>Autosave todo dia 1 do mês</span>
            </label>

            <div className="settings-modal__danger-zone">
              <h4>Zona de Perigo</h4>
              <button className="settings-modal__btn settings-modal__btn--danger" onClick={() => {
                if(confirm('Tem certeza? Isso vai apagar seu save atual e reiniciar o jogo.')) {
                  onNewGame();
                }
              }}>
                🗑️ Novo Jogo (apaga save)
              </button>
            </div>
          </div>
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