import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTranslation } from 'react-i18next';
const logoSrc = '/logo.png';
import './Display.css';
import './Leaderboard.css';

export default function Bracket() {
  const [entries, setEntries] = useState([]);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      const data = await api.getBracket();
      setEntries(data);
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
        <h2 className="lb-mobile-title">{t('bracket.title')}</h2>
        {entries.length === 0 ? (
          <p className="display-empty" style={{ fontSize: '1rem', padding: '24px' }}>
            {t('bracket.empty')}
          </p>
        ) : (
          <div className="match-cards-grid">
            {entries.map((e) => (
              <BracketMatchCard key={e.id} entry={e} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatchCard({ entry, t }) {
  const hasResult = entry.kills != null && entry.deaths != null;
  const playerWins = hasResult && entry.kills > entry.deaths;
  const romeroWins = hasResult && entry.deaths > entry.kills;

  return (
    <div className={`match-card${hasResult ? ' match-card--has-result' : ''}`}>
      {/* Player */}
      <div
        className={`match-fighter${playerWins ? ' match-fighter--winner' : romeroWins ? ' match-fighter--loser' : ''}`}
      >
        <span
          className="match-fighter-crown"
          style={{ visibility: playerWins ? 'visible' : 'hidden' }}
        >
          👑
        </span>
        <img
          src={romeroWins ? '/player-0.png' : '/player-100.png'}
          className="match-fighter-portrait"
          alt={entry.nick_name}
        />
        <div className="match-fighter-name">{entry.nick_name}</div>
        {hasResult && (
          <div className="match-fighter-stats">
            {entry.kills}K · {entry.deaths}D
          </div>
        )}
      </div>

      <div className="match-vs">VS</div>

      {/* John Romero */}
      <div
        className={`match-fighter${romeroWins ? ' match-fighter--winner' : playerWins ? ' match-fighter--loser' : ''}`}
      >
        <span
          className="match-fighter-crown"
          style={{ visibility: romeroWins ? 'visible' : 'hidden' }}
        >
          👑
        </span>
        <img
          src={playerWins ? '/jr-0.png' : '/jr-100.png'}
          className="match-fighter-portrait"
          alt="John Romero"
        />
        <div className="match-fighter-name">{t('bracket.romero')}</div>
        {hasResult && (
          <div className="match-fighter-stats">
            {entry.deaths}K · {entry.kills}D
          </div>
        )}
      </div>
    </div>
  );
}
