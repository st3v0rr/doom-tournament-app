import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useTranslation } from 'react-i18next';
import { getLocale, formatTime, formatDateTimeOrDash } from '../utils/locale';
import './Admin.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function TimeSelect({ value, onChange, required, style }) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const set = (newH, newM) => onChange(`${newH}:${newM}`);
  return (
    <div style={{ display: 'flex', gap: 4, ...style }}>
      <select
        className="input"
        style={{ flex: 1 }}
        value={h || ''}
        required={required}
        onChange={(e) => set(e.target.value, m || '00')}
      >
        <option value="">hh</option>
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>
            {hh}
          </option>
        ))}
      </select>
      <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)' }}>:</span>
      <select
        className="input"
        style={{ flex: 1 }}
        value={m || ''}
        required={required}
        onChange={(e) => set(h || '00', e.target.value)}
      >
        <option value="">mm</option>
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
    </div>
  );
}

const TAB_IDS = ['tickets', 'slots', 'participants', 'bracket'];

export default function Admin() {
  const [tab, setTab] = useState('tickets');
  const { t } = useTranslation();

  return (
    <div className="page-wide">
      <h1>{t('admin.title')}</h1>
      <div className="admin-tabs">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            className={`admin-tab btn ${tab === id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(id)}
          >
            {t(`admin.tab.${id}`)}
          </button>
        ))}
        <button
          className={`admin-tab admin-tab-setup btn ${tab === 'setup' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('setup')}
        >
          {t('admin.tab.setup')}
        </button>
      </div>
      <div className="admin-content">
        {tab === 'setup' && <SetupTab />}
        {tab === 'tickets' && <TicketsTab />}
        {tab === 'slots' && <SlotsTab />}
        {tab === 'bracket' && <BracketTab />}
        {tab === 'participants' && <ParticipantsTab />}
      </div>
    </div>
  );
}

// --- Setup ---
function SetupTab() {
  const { t, i18n } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [migrateMsg, setMigrateMsg] = useState('');
  const [migrateError, setMigrateError] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');

  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState(15);
  const [clearExisting, setClearExisting] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [seedError, setSeedError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const [rescheduleDate, setRescheduleDate] = useState(today);
  const [rescheduleMsg, setRescheduleMsg] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const loadStatus = useCallback(() => {
    setStatusError('');
    api
      .adminSetupStatus()
      .then(setStatus)
      .catch((e) => setStatusError(e.message));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runMigrate = async () => {
    setMigrateMsg('');
    setMigrateError('');
    try {
      await api.adminMigrate();
      setMigrateMsg(t('admin.setup.dbInitialized'));
    } catch (e) {
      setMigrateError(e.message);
    }
  };

  const runReset = async () => {
    setResetMsg('');
    setResetError('');
    try {
      await api.adminResetDatabase();
      setResetMsg(t('admin.danger.resetSuccess'));
      setResetConfirm('');
      loadStatus();
    } catch (e) {
      setResetError(e.message);
    }
  };

  const runSeed = async (e) => {
    e.preventDefault();
    setSeedMsg('');
    setSeedError('');
    setSeeding(true);
    try {
      const res = await api.adminSeedSlots({
        date,
        start_time: startTime,
        end_time: endTime,
        slot_duration: Number(slotDuration),
        clear_existing: clearExisting,
      });
      setSeedMsg(t('admin.setup.seedSuccess', { count: res.seeded }));
      setClearExisting(false);
      loadStatus();
    } catch (e) {
      setSeedError(e.message);
    } finally {
      setSeeding(false);
    }
  };

  const runReschedule = async (e) => {
    e.preventDefault();
    setRescheduleMsg('');
    setRescheduleError('');
    setRescheduling(true);
    try {
      const res = await api.adminReschedule({ new_date: rescheduleDate });
      setRescheduleMsg(t('admin.setup.rescheduleSuccess', { count: res.updated }));
      loadStatus();
    } catch (e) {
      setRescheduleError(e.message);
    } finally {
      setRescheduling(false);
    }
  };

  const slotCount = status
    ? Math.floor(
        (Number(endTime.split(':')[0]) * 60 +
          Number(endTime.split(':')[1]) -
          (Number(startTime.split(':')[0]) * 60 + Number(startTime.split(':')[1]))) /
          Number(slotDuration)
      )
    : null;

  const locale = getLocale(i18n.language);
  const formatDt = (iso) => formatDateTimeOrDash(iso, locale);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* DB Status */}
      <div className="card">
        <h2>{t('admin.setup.dbStatus')}</h2>
        {statusError && <p className="error-msg">{statusError}</p>}
        {status && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--spacing-md)',
              marginTop: 'var(--spacing-sm)',
            }}
          >
            <div className="stat-card">
              <span className="stat-label">{t('admin.setup.slotsTotal')}</span>
              <span className="stat-value">{status.slot_count}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">{t('admin.setup.bookedCompleted')}</span>
              <span className="stat-value">{status.booked_count}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">{t('admin.setup.firstSlot')}</span>
              <span className="stat-value" style={{ fontSize: '1rem' }}>
                {formatDt(status.nick_slot)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">{t('admin.setup.lastSlot')}</span>
              <span className="stat-value" style={{ fontSize: '1rem' }}>
                {formatDt(status.last_slot)}
              </span>
            </div>
          </div>
        )}
        <button
          className="btn btn-secondary"
          style={{ marginTop: 'var(--spacing-md)' }}
          onClick={loadStatus}
        >
          {t('admin.setup.refresh')}
        </button>
      </div>

      {/* Seed */}
      <div className="card">
        <h2>{t('admin.setup.configTitle')}</h2>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          {t('admin.setup.configHint')}
        </p>

        {status?.slot_count > 0 && !clearExisting && (
          <div className="error-msg" style={{ marginBottom: 'var(--spacing-md)' }}>
            {t('admin.setup.slotsExist', { count: status.slot_count })}
          </div>
        )}

        <form
          onSubmit={runSeed}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            maxWidth: 440,
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {t('admin.setup.raceDay')}
            </span>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {t('admin.setup.startTime')}
              </span>
              <TimeSelect value={startTime} onChange={setStartTime} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {t('admin.setup.endTime')}
              </span>
              <TimeSelect value={endTime} onChange={setEndTime} required />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {t('admin.setup.slotDuration')}
            </span>
            <select
              className="input"
              value={slotDuration}
              onChange={(e) => setSlotDuration(e.target.value)}
            >
              {[1, 2, 3, 5, 10, 15, 20, 30].map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>

          {slotCount !== null && slotCount > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t('admin.setup.slotsWillBeCreated', {
                count: slotCount,
                start: startTime,
                end: endTime,
                duration: slotDuration,
              })}
            </p>
          )}

          {status?.slot_count > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                disabled={status?.booked_count > 0}
              />
              <span style={{ fontSize: '0.9rem' }}>{t('admin.setup.clearExisting')}</span>
            </label>
          )}

          {seedMsg && <p className="success-msg">{seedMsg}</p>}
          {seedError && <p className="error-msg">{seedError}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={seeding || (status?.slot_count > 0 && !clearExisting)}
          >
            {seeding ? t('admin.setup.creating') : t('admin.setup.createSlots')}
          </button>
        </form>
      </div>

      {/* Reschedule */}
      {status?.slot_count > 0 && (
        <div className="card">
          <h2>{t('admin.setup.rescheduleTitle')}</h2>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            {t('admin.setup.rescheduleHint')}
          </p>
          <form
            onSubmit={runReschedule}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)',
              maxWidth: 440,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {t('admin.setup.raceDay')}
              </span>
              <input
                type="date"
                className="input"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                required
              />
            </label>
            {rescheduleMsg && <p className="success-msg">{rescheduleMsg}</p>}
            {rescheduleError && <p className="error-msg">{rescheduleError}</p>}
            <button type="submit" className="btn btn-primary" disabled={rescheduling}>
              {rescheduling ? t('admin.setup.rescheduling') : t('admin.setup.reschedule')}
            </button>
          </form>
        </div>
      )}

      <ScheduleEventsEditor />

      {/* Danger Zone */}
      <div className="card setup-danger-zone">
        <h2>{t('admin.danger.title')}</h2>

        <div className="danger-zone-section">
          <div>
            <strong>{t('admin.danger.initTitle')}</strong>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              {t('admin.danger.initHint')}
            </p>
          </div>
          {migrateMsg && (
            <p className="success-msg" style={{ margin: 0 }}>
              {migrateMsg}
            </p>
          )}
          {migrateError && (
            <p className="error-msg" style={{ margin: 0 }}>
              {migrateError}
            </p>
          )}
          <button
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start' }}
            onClick={runMigrate}
          >
            {t('admin.danger.init')}
          </button>
        </div>

        <div className="danger-zone-divider" />

        <div className="danger-zone-section">
          <div>
            <strong>{t('admin.danger.resetTitle')}</strong>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              {t('admin.danger.resetHint')}
            </p>
          </div>
          {resetMsg && (
            <p className="success-msg" style={{ margin: 0 }}>
              {resetMsg}
            </p>
          )}
          {resetError && (
            <p className="error-msg" style={{ margin: 0 }}>
              {resetError}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-sm)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <input
              className="input"
              style={{ maxWidth: 260 }}
              placeholder={t('admin.danger.resetConfirmPlaceholder')}
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
            />
            <button
              className="btn btn-danger"
              disabled={resetConfirm !== 'RESET'}
              onClick={runReset}
            >
              {t('admin.danger.reset')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Schedule Events Editor ---
function ScheduleEventsEditor() {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api.adminGetSchedule().then(setEvents), []);
  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (ev) => {
    setEditId(ev.id);
    setEditData({ time_from: ev.time_from, time_to: ev.time_to || '', event: ev.event });
  };
  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    setMsg('');
    setError('');
    try {
      await api.adminUpdateScheduleEvent(editId, {
        time_from: editData.time_from,
        time_to: editData.time_to || null,
        event: editData.event,
      });
      setEditId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const del = async (id) => {
    setMsg('');
    setError('');
    try {
      await api.adminDeleteScheduleEvent(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api.adminAddScheduleEvent(newFrom, newEvent, newTo || null);
      setNewFrom('');
      setNewTo('');
      setNewEvent('');
      setMsg(t('admin.schedule.added'));
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card">
      <h2>{t('admin.schedule.title')}</h2>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.9rem',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        {t('admin.schedule.hint')}
      </p>

      {msg && <p className="success-msg">{msg}</p>}
      {error && <p className="error-msg">{error}</p>}

      <table style={{ marginBottom: 'var(--spacing-md)' }}>
        <thead>
          <tr>
            <th>{t('admin.schedule.from')}</th>
            <th>{t('admin.schedule.to')}</th>
            <th>{t('admin.schedule.event')}</th>
            <th style={{ textAlign: 'right' }}></th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
                {t('admin.schedule.noEntries')}
              </td>
            </tr>
          )}
          {events.map((ev) => (
            <tr key={ev.id}>
              <td>
                {editId === ev.id ? (
                  <TimeSelect
                    value={editData.time_from}
                    onChange={(v) => setEditData({ ...editData, time_from: v })}
                    style={{ width: 130 }}
                  />
                ) : (
                  <span style={{ fontFamily: 'monospace' }}>{ev.time_from}</span>
                )}
              </td>
              <td>
                {editId === ev.id ? (
                  <TimeSelect
                    value={editData.time_to}
                    onChange={(v) => setEditData({ ...editData, time_to: v })}
                    style={{ width: 130 }}
                  />
                ) : (
                  <span style={{ fontFamily: 'monospace' }}>{ev.time_to || '—'}</span>
                )}
              </td>
              <td>
                {editId === ev.id ? (
                  <input
                    className="input"
                    style={{ padding: '4px 8px', width: '100%' }}
                    value={editData.event}
                    onChange={(e) => setEditData({ ...editData, event: e.target.value })}
                  />
                ) : (
                  ev.event
                )}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {editId === ev.id ? (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveEdit}>
                      ✓
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(ev)}>
                      ✎
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(ev.id)}>
                      ×
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        onSubmit={add}
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {t('admin.schedule.from')}
          </span>
          <TimeSelect value={newFrom} onChange={setNewFrom} required style={{ width: 150 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {t('admin.schedule.toOptional')}
          </span>
          <TimeSelect value={newTo} onChange={setNewTo} style={{ width: 150 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {t('admin.schedule.event')}
          </span>
          <input
            className="input"
            placeholder={t('admin.schedule.eventPlaceholder')}
            value={newEvent}
            onChange={(e) => setNewEvent(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary">
          {t('admin.schedule.add')}
        </button>
      </form>
    </div>
  );
}

// --- Tickets ---
function TicketsTab() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [nickName, setNickName] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api.adminGetTickets().then(setTickets), []);

  useEffect(() => {
    load();
  }, [load]);

  const addTicket = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await api.adminAddTicket(nickName, ticketNumber);
      setMsg(t('admin.tickets.added'));
      setNickName('');
      setTicketNumber('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTicket = async (id) => {
    if (!confirm(t('admin.tickets.deleteConfirm'))) return;
    try {
      await api.adminDeleteTicket(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card" style={{ maxWidth: 400 }}>
          <h2>{t('admin.tickets.walkUpTitle')}</h2>
          <form
            onSubmit={addTicket}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}
          >
            <input
              className="input"
              placeholder={t('admin.tickets.nicknamePlaceholder')}
              value={nickName}
              onChange={(e) => setNickName(e.target.value)}
              required
              minLength={3}
              maxLength={30}
            />
            <input
              className="input"
              placeholder={t('admin.tickets.ticketPlaceholder')}
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value.replace(/\D/g, '').slice(0, 5))}
              pattern="\d{5}"
              required
            />
            <button type="submit" className="btn btn-primary">
              {t('admin.tickets.add')}
            </button>
          </form>
        </div>
      </div>
      {msg && <p className="success-msg">{msg}</p>}
      {error && <p className="error-msg">{error}</p>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>{t('admin.tickets.colNickname')}</th>
              <th>{t('admin.tickets.colTicket')}</th>
              <th>{t('admin.tickets.colWalkUp')}</th>
              <th>{t('admin.tickets.colClaimed')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.nick_name}</td>
                <td style={{ fontFamily: 'monospace' }}>{ticket.ticket_number}</td>
                <td>{ticket.is_walk_up ? '✓' : '—'}</td>
                <td>
                  {ticket.claimed ? (
                    <span className="badge badge-success">{t('admin.tickets.yes')}</span>
                  ) : (
                    <span className="badge badge-muted">{t('admin.tickets.no')}</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteTicket(ticket.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Slots ---
function SlotsTab() {
  const { t, i18n } = useTranslation();
  const [slots, setSlots] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [msg, setMsg] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api.adminGetSlots().then(setSlots), []);

  useEffect(() => {
    load();
  }, [load]);

  const locale = getLocale(i18n.language);
  const fmt = (iso) => formatTime(iso, locale);

  const startEdit = (slot) => {
    setEditId(slot.id);
    setEditData({
      status: slot.status,
      results: slot.players.map((p) => ({
        participant_id: p.id,
        nick_name: p.nick_name,
        kills: p.kills ?? '',
        deaths: p.deaths ?? '',
      })),
    });
  };

  const saveEdit = async (id) => {
    setError('');
    setMsg('');
    setWarning('');
    const payload = { status: editData.status };
    const results = editData.results
      .filter((r) => r.kills !== '' || r.deaths !== '')
      .map((r) => ({
        participant_id: r.participant_id,
        kills: r.kills !== '' ? parseInt(r.kills, 10) : null,
        deaths: r.deaths !== '' ? parseInt(r.deaths, 10) : null,
      }));
    if (results.length > 0) payload.results = results;
    try {
      const res = await api.adminUpdateSlot(id, payload);
      if (res.warning) {
        setWarning(res.warning);
      } else {
        setMsg(t('admin.slots.saved'));
      }
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateResult = (idx, field, value) => {
    const newResults = [...editData.results];
    newResults[idx] = { ...newResults[idx], [field]: value };
    setEditData({ ...editData, results: newResults });
  };

  return (
    <div>
      {msg && <p className="success-msg">{msg}</p>}
      {warning && (
        <p
          className="error-msg"
          style={{
            background: 'var(--color-warning-bg, #fff3cd)',
            borderColor: 'var(--color-warning, #ffc107)',
            color: 'var(--color-warning-text, #856404)',
          }}
        >
          {warning}
        </p>
      )}
      {error && <p className="error-msg">{error}</p>}
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>{t('admin.slots.colTime')}</th>
              <th>{t('admin.slots.colStatus')}</th>
              <th>{t('admin.slots.colPlayers')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.flatMap((slot) => {
              const rows = [
                <tr key={slot.id}>
                  <td style={{ fontWeight: 600 }}>{fmt(slot.start_time)}</td>
                  <td>
                    {editId === slot.id ? (
                      <select
                        className="input"
                        style={{ padding: '4px 8px' }}
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                      >
                        <option value="available">available</option>
                        <option value="full">full</option>
                        <option value="completed">completed</option>
                      </select>
                    ) : (
                      <span
                        className={`badge ${slot.status === 'available' ? 'badge-success' : slot.status === 'full' ? 'badge-warning' : 'badge-muted'}`}
                      >
                        {slot.status}
                      </span>
                    )}
                  </td>
                  <td>{slot.player_count}/4</td>
                  <td>
                    {editId === slot.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveEdit(slot.id)}
                        >
                          ✓
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditId(null)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(slot)}>
                        {t('admin.slots.edit')}
                      </button>
                    )}
                  </td>
                </tr>,
              ];

              if (editId === slot.id && editData.results.length > 0) {
                rows.push(
                  <tr key={`${slot.id}-players`}>
                    <td
                      colSpan={4}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'var(--color-surface-alt, rgba(0,0,0,0.03))',
                      }}
                    >
                      <table style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', fontSize: '0.85rem' }}>Player</th>
                            <th style={{ textAlign: 'left', fontSize: '0.85rem' }}>
                              {t('admin.slots.colKills')}
                            </th>
                            <th style={{ textAlign: 'left', fontSize: '0.85rem' }}>
                              {t('admin.slots.colDeaths')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {editData.results.map((r, idx) => (
                            <tr key={r.participant_id}>
                              <td style={{ padding: '4px 8px 4px 0' }}>{r.nick_name}</td>
                              <td style={{ padding: '4px 4px' }}>
                                <input
                                  type="number"
                                  min={0}
                                  className="input"
                                  style={{ padding: '4px 8px', width: 80 }}
                                  value={r.kills}
                                  onChange={(e) => updateResult(idx, 'kills', e.target.value)}
                                />
                              </td>
                              <td style={{ padding: '4px 4px' }}>
                                <input
                                  type="number"
                                  min={0}
                                  className="input"
                                  style={{ padding: '4px 8px', width: 80 }}
                                  value={r.deaths}
                                  onChange={(e) => updateResult(idx, 'deaths', e.target.value)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Bracket ---
function BracketTab() {
  const { t } = useTranslation();
  const [participants, setParticipants] = useState([]);
  const [entries, setEntries] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.adminGetParticipants(), api.getBracket()]).then(([p, b]) => {
      setParticipants(p);
      setEntries(b);
    });
  }, []);

  const addEntry = (participantId) => {
    if (entries.find((e) => e.participant_id === participantId)) return;
    const rank = top4.findIndex((p) => p.id === participantId);
    const position = rank >= 0 ? rank + 1 : null;
    setEntries([
      ...entries,
      { participant_id: participantId, round: 'final', position, kills: null, deaths: null },
    ]);
  };

  const setResult = (participantId, field, value) => {
    setEntries(
      entries.map((e) =>
        e.participant_id === participantId
          ? { ...e, [field]: value !== '' ? parseInt(value, 10) : null }
          : e
      )
    );
  };

  const removeEntry = (participantId) => {
    setEntries(entries.filter((e) => e.participant_id !== participantId));
  };

  const save = async () => {
    setError('');
    setMsg('');
    try {
      await api.adminUpdateBracket(entries);
      setMsg(t('admin.bracket.saved'));
    } catch (err) {
      setError(err.message);
    }
  };

  const top4 = [...participants]
    .filter((p) => p.best_kd != null)
    .sort((a, b) => b.best_kd - a.best_kd)
    .slice(0, 4);

  const finalEntries = entries.filter((e) => e.round === 'final');
  const finalParticipants = finalEntries
    .map((e) => participants.find((p) => p.id === e.participant_id))
    .filter(Boolean);
  const available = top4.filter((p) => !finalEntries.find((e) => e.participant_id === p.id));

  return (
    <div>
      {msg && <p className="success-msg">{msg}</p>}
      {error && <p className="error-msg">{error}</p>}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2>{t('admin.bracket.final')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {finalParticipants.map((p) => {
            const entry = finalEntries.find((e) => e.participant_id === p.id);
            const rank = top4.findIndex((t_) => t_.id === p.id);
            const playerWins =
              entry?.kills != null && entry?.deaths != null && entry.kills > entry.deaths;
            const romeroWins =
              entry?.kills != null && entry?.deaths != null && entry.deaths > entry.kills;
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      flex: 1,
                      fontWeight: playerWins ? 700 : 'normal',
                      color: playerWins ? 'var(--color-gold)' : undefined,
                    }}
                  >
                    {playerWins ? '👑 ' : ''}
                    {rank >= 0 ? `#${rank + 1} ` : ''}
                    {p.nick_name}
                    {p.best_kd != null ? ` – K/D ${p.best_kd.toFixed(2)}` : ''}
                  </span>
                  <button className="btn btn-danger btn-sm" onClick={() => removeEntry(p.id)}>
                    ×
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {t('admin.bracket.playerKills')}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={entry?.kills ?? ''}
                      onChange={(e) => setResult(p.id, 'kills', e.target.value)}
                      className="input"
                      style={{ padding: '4px 8px' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: romeroWins ? 'var(--color-gold)' : 'var(--color-text-muted)',
                      }}
                    >
                      {romeroWins ? '👑 ' : ''}
                      {t('admin.bracket.romeroKills')}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={entry?.deaths ?? ''}
                      onChange={(e) => setResult(p.id, 'deaths', e.target.value)}
                      className="input"
                      style={{ padding: '4px 8px' }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
          {available.length > 0 && (
            <select
              className="input"
              style={{ padding: '6px 8px' }}
              onChange={(e) => {
                if (e.target.value) {
                  addEntry(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">{t('admin.bracket.addPlayer')}</option>
              {available.map((p) => {
                const rank = top4.findIndex((t_) => t_.id === p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {rank >= 0 ? `#${rank + 1} ` : ''}
                    {p.nick_name}
                    {p.best_kd != null ? ` – K/D ${p.best_kd.toFixed(2)}` : ''}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>
      <button className="btn btn-primary" onClick={save}>
        {t('admin.bracket.save')}
      </button>
    </div>
  );
}

// --- Participants ---
function ParticipantsTab() {
  const { t } = useTranslation();
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    api.adminGetParticipants().then(setParticipants);
  }, []);

  return (
    <div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>{t('admin.participants.colName')}</th>
              <th>{t('admin.participants.colTicket')}</th>
              <th>{t('admin.participants.colSlots')}</th>
              <th>{t('admin.participants.colBestKd')}</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id}>
                <td>{p.nick_name}</td>
                <td style={{ fontFamily: 'monospace' }}>{p.ticket_number}</td>
                <td>{p.slot_count}</td>
                <td style={{ fontFamily: 'monospace' }}>
                  {p.best_kd != null ? Number(p.best_kd).toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
