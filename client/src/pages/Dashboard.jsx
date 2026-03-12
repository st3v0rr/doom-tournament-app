import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useTranslation } from 'react-i18next';
import { getLocale, formatTimeOrDash } from '../utils/locale';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  const reload = () =>
    api
      .getMe()
      .then(setData)
      .catch((err) => setError(err.message));

  useEffect(() => {
    reload();
  }, []);

  const handleCancel = async (slotId) => {
    setCancelError('');
    setCancelling(true);
    try {
      await api.cancelSlot(slotId);
      setCancelConfirmId(null);
      await reload();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (error)
    return (
      <div className="page">
        <p className="error-msg">{error}</p>
      </div>
    );
  if (!data)
    return (
      <div className="page">
        <p style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      </div>
    );

  const locale = getLocale(i18n.language);
  const formatTime = (iso) => formatTimeOrDash(iso, locale);
  const clockSuffix = t('dashboard.clock');

  const slots = data.slots || [];

  const statusBadgeClass = (status) => {
    if (status === 'completed') return 'badge-success';
    if (status === 'full') return 'badge-warning';
    return 'badge-primary';
  };

  const statusLabel = (status) => {
    if (status === 'completed') return t('dashboard.completed');
    if (status === 'full') return t('dashboard.full');
    return t('dashboard.booked');
  };

  return (
    <div className="page">
      <h1>{t('dashboard.greeting', { name: data.nick_name })}</h1>

      <div className="card">
        <h2>{t('dashboard.mySlot')}</h2>
        {slots.length === 0 ? (
          <div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-md)' }}>
              {t('dashboard.noSlot')}
            </p>
            <Link to="/slots" className="btn btn-primary">
              {t('dashboard.bookSlot')}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {slots.map((slot) => (
              <div
                key={slot.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: 'var(--spacing-sm)',
                }}
              >
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {formatTime(slot.start_time)}
                    {clockSuffix ? ` ${clockSuffix}` : ''}
                  </span>
                  <span className={`badge ${statusBadgeClass(slot.status)}`}>
                    {statusLabel(slot.status)}
                  </span>
                </div>
                {slot.status === 'completed' && slot.kills !== null && (
                  <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: '0.95rem' }}>
                    <span>
                      {t('dashboard.kills')}: <strong>{slot.kills}</strong>
                    </span>
                    <span>
                      {t('dashboard.deaths')}: <strong>{slot.deaths}</strong>
                    </span>
                    <span>
                      {t('dashboard.kdRatio')}:{' '}
                      <strong>{slot.kd_ratio != null ? slot.kd_ratio.toFixed(2) : '—'}</strong>
                    </span>
                  </div>
                )}
                {slot.status !== 'completed' && (
                  <div>
                    {cancelConfirmId === slot.id ? (
                      <div
                        style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}
                      >
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {t('slots.cancelConfirm')}
                        </span>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancel(slot.id)}
                          disabled={cancelling}
                        >
                          {cancelling ? t('dashboard.cancelling') : t('dashboard.cancelSlot')}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setCancelConfirmId(null)}
                          disabled={cancelling}
                        >
                          {t('common.back')}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setCancelConfirmId(slot.id)}
                      >
                        {t('dashboard.cancelSlot')}
                      </button>
                    )}
                    {cancelError && (
                      <p className="error-msg" style={{ marginTop: 'var(--spacing-xs)' }}>
                        {cancelError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {slots.length < 2 && (
              <Link to="/slots" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                {t('dashboard.bookAnother')}
              </Link>
            )}
          </div>
        )}
      </div>

      {data.rank && (
        <div className="card">
          <h2>{t('dashboard.myRanking')}</h2>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>
            #{data.rank}
            {data.rank <= 4 && (
              <span style={{ color: 'var(--color-gold)', marginLeft: 8 }}>
                {t('dashboard.top4')}
              </span>
            )}
          </p>
          {data.rank === 1 && slots.some((s) => s.status === 'completed') && (
            <p style={{ color: 'var(--color-gold)', fontWeight: 700 }}>
              {t('dashboard.bestKd')}:{' '}
              {(() => {
                const completed = slots.filter((s) => s.status === 'completed' && s.kills != null);
                const tk = completed.reduce((sum, s) => sum + s.kills, 0);
                const td = completed.reduce((sum, s) => sum + (s.deaths ?? 0), 0);
                return (tk / Math.max(1, td)).toFixed(2);
              })()}
            </p>
          )}
        </div>
      )}

      {data.bracket?.length > 0 && (
        <div className="card">
          <h2>{t('dashboard.bracket')}</h2>
          {data.bracket.map((b, i) => {
            const isWinner = b.round === 'final' && b.kills != null && b.kills > (b.deaths ?? 0);
            return (
              <div key={i} style={{ marginTop: i > 0 ? 'var(--spacing-sm)' : 0 }}>
                <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>
                  {t('dashboard.final')}
                  <span style={{ color: 'var(--color-gold)', marginLeft: 8 }}>🔥</span>
                </p>
                {b.kills != null && b.deaths != null && (
                  <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                    {b.kills}K / {b.deaths}D{' '}
                    {b.kills > b.deaths ? '🏆' : b.deaths > b.kills ? '(Romero wins)' : ''}
                  </p>
                )}
                {isWinner && (
                  <p style={{ color: 'var(--color-gold)', fontWeight: 700, marginTop: 4 }}>
                    {t('dashboard.winner')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
