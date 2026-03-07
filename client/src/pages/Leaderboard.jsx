import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTranslation } from 'react-i18next';
const logoSrc = '/logo.png';
import './Display.css';
import './Leaderboard.css';

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      const data = await api.getAllLeaderboard();
      setRows(data);
    } catch {
      // keep previous data
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="lb-mobile">
      <div className="display-header">
        <button className="lb-back-btn" onClick={() => navigate(-1)} title={t('common.back')}>
          ←
        </button>
        <img src={logoSrc} alt="Doom Tournament" className="lb-header-logo" />
        <button className="btn btn-secondary btn-sm" onClick={load}>
          ↻
        </button>
      </div>

      <div className="lb-mobile-content">
        <h2 className="lb-mobile-title">{t('leaderboard.title')}</h2>
        {rows.length === 0 ? (
          <p className="display-empty" style={{ fontSize: '1rem', padding: '24px' }}>
            {t('leaderboard.empty')}
          </p>
        ) : (
          <div className="display-leaderboard">
            {rows.map((row, i) => (
              <div key={i} className="display-lb-row">
                <span className="display-lb-rank">#{i + 1}</span>
                <span className="display-lb-name">{row.nick_name}</span>
                <span className="display-lb-time">
                  {row.best_kd != null ? row.best_kd.toFixed(2) : '—'}
                  {row.total_kills != null && (
                    <span
                      style={{
                        fontSize: '0.75em',
                        color: 'var(--color-text-muted)',
                        marginLeft: 6,
                      }}
                    >
                      ({row.total_kills}/{row.total_deaths ?? 0})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
