/**
 * ============================================================
 * MODAL DE CONFIGURAÇÕES - COM MULTI SAVE
 * ============================================================
 */

import React from 'react';
import { AIDifficulty } from '../types/difficulty';
import { DifficultySelector } from './DifficultySelector';

const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

function formatGameDatePt(day: number, month: number, year: number) {
  const mesNome = MESES_PT[(month - 1)] || `Mês ${month}`;
  return `${day} de ${mesNome}, ${year}`;
}

export interface SaveMeta {
  id: string;
  name: string;
  date: any;
  ts: number;
  year: number;
  month: number;
  day: number;
  playerTag: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiDifficulty: AIDifficulty;
  onDifficultyChange: (difficulty: AIDifficulty) => void;
  saves: SaveMeta[];
  autoSaveEnabled: boolean;
  onToggleAutoSave: (v: boolean) => void;
  onSaveNew: () => void;
  onLoad: (slotId: string) => void;
  onDelete: (slotId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiDifficulty,
  onDifficultyChange,
  saves,
  autoSaveEnabled,
  onToggleAutoSave,
  onSaveNew,
  onLoad,
  onDelete
}) => {
  if (!isOpen) return null;

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch { return ''; }
  };

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
              <button className="settings-modal__btn settings-modal__btn--primary" onClick={onSaveNew}>
                + Novo Save Manual
              </button>
              <label className="settings-modal__toggle">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => onToggleAutoSave(e.target.checked)}
                />
                <span>Autosave (dia 1)</span>
              </label>
            </div>

            <div className="settings-modal__save-list">
              <h4>Seus Saves ({saves.length})</h4>
              {saves.length === 0 && (
                <p className="settings-modal__empty">Nenhum save ainda. Crie um!</p>
              )}
              {saves.map(s => (
                <div key={s.id} className="settings-modal__save-item">
                  <div className="settings-modal__save-info">
                    <strong>{s.id === 'autosave' ? '🔄 Autosave' : `💾 ${s.name}`}</strong>
                    <span>{formatGameDatePt(s.day, s.month, s.year)} | {formatDate(s.ts)}</span>
                  </div>
                  <div className="settings-modal__save-btns">
                    <button className="settings-modal__btn--small" onClick={() => onLoad(s.id)}>📂 Carregar</button>
                    <button className="settings-modal__btn--small settings-modal__btn--danger" onClick={() => onDelete(s.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="settings-modal__section settings-modal__danger-zone">
            <h4>Zona de Perigo</h4>
            <p className="settings-modal__hint">Reiniciar começa um novo jogo sem apagar seus saves manuais. Seus saves continuam aqui.</p>
            <button className="settings-modal__btn settings-modal__btn--danger" onClick={() => {
              if(confirm('Começar novo jogo? Seus saves manuais NÃO serão apagados, apenas o autosave será ignorado.')) {
                window.location.href = window.location.pathname + '?newgame=1';
              }
            }}>
              🔄 Novo Jogo
            </button>
          </div>
        </div>

        <div className="settings-modal__footer">
          <button className="settings-modal__btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};