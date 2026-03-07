import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getLocale, formatTime } from '../utils/locale';
import './Slots.css';

export default function Slots() {
  const { auth } = useAuth();
  const { t, i18n } = useTranslation();
  const [slots, setSlots] = useState([]);
  const [mySlots, setMySlots] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [slotsData, meData] = await Promise.all([
        api.getSlots(),
        auth?.role === 'participant' ? api.getMe() : Promise.resolve(null),
      ]);
      setSlots(slotsData);
      setMySlots(meData?.slots || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    load();
  }, [load]);

  const locale = getLocale(i18n.language);

  const canBook = (slot) => {
    if (mySlots.length >= 2) return false;
    if (slot.status === 'completed') return false;
    if (slot.player_count >= 4) return false;
    if (mySlots.some((s) => s.id === slot.id)) return false;
    const slotTime = new Date(slot.start_time);
    return slotTime > new Date(Date.now() + 10 * 60 * 1000);
  };

  const book = async (id) => {
    setActionId(id);
    setError('');
    setMsg('');
    try {
      await api.bookSlot(id);
      setMsg(t('slots.bookSuccess'));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  const cancelSlot = async (slotId) => {
    setActionId(slotId);
    setError('');
    setMsg('');
    try {
      await api.cancelSlot(slotId);
      setMsg(t('slots.cancelSuccess'));
      setCancelConfirmId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  if (loading)
    return (
      <div className="page">
        <p style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      </div>
    );

  const statusLabel = (s) => {
    if (s === 'available') return { label: t('slots.available'), cls: 'badge-success' };
    if (s === 'full') return { label: t('slots.full'), cls: 'badge-warning' };
    return { label: t('slots.completed'), cls: 'badge-muted' };
  };

  const clockSuffix = t('slots.clock');

  return (
    <div className="page">
      <h1>{t('slots.title')}</h1>
      {mySlots.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <strong>{t('slots.mySlot')}</strong>
          {mySlots.map((mySlot) => (
            <div key={mySlot.id} style={{ marginTop: 'var(--spacing-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span>
                  {formatTime(mySlot.start_time, locale)}
                  {clockSuffix ? ` ${clockSuffix}` : ''}
                </span>
                <span className={`badge ${statusLabel(mySlot.status).cls}`}>
                  {statusLabel(mySlot.status).label}
                </span>
              </div>
              {mySlot.status !== 'completed' && (
                <div style={{ marginTop: 'var(--spacing-xs)' }}>
                  {cancelConfirmId === mySlot.id ? (
                    <div
                      style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}
                    >
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {t('slots.cancelConfirm')}
                      </span>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actionId === mySlot.id}
                        onClick={() => cancelSlot(mySlot.id)}
                      >
                        {t('slots.cancel')}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCancelConfirmId(null)}
                      >
                        {t('common.back')}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setCancelConfirmId(mySlot.id)}
                    >
                      {t('slots.cancel')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="error-msg">{error}</p>}
      {msg && <p className="success-msg">{msg}</p>}
      <div className="slots-grid">
        {slots.map((slot) => {
          const { label, cls } = statusLabel(slot.status);
          const isMine = mySlots.some((s) => s.id === slot.id);
          return (
            <div key={slot.id} className={`slot-card ${isMine ? 'slot-mine' : ''}`}>
              <div className="slot-time">{formatTime(slot.start_time, locale)}</div>
              <span className={`badge ${cls}`}>{label}</span>
              <div
                className="slot-player"
                style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}
              >
                {t('slots.playerCount', { count: slot.player_count })}
              </div>
              {slot.player_names.length > 0 && (
                <div className="slot-player" style={{ fontSize: '0.8rem' }}>
                  {slot.player_names.join(', ')}
                </div>
              )}
              {auth?.role === 'participant' && canBook(slot) && (
                <div className="slot-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => book(slot.id)}
                    disabled={actionId === slot.id}
                  >
                    {t('slots.book')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
