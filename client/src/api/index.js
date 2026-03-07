const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
    const err = new Error('Zu viele Versuche. Bitte warte kurz.');
    err.retryAfter = retryAfter;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  register: (nick_name, nick_name_confirm, ticket_number, ticket_number_confirm) =>
    request('POST', '/auth/register', {
      nick_name,
      nick_name_confirm,
      ticket_number,
      ticket_number_confirm,
    }),
  login: (nick_name, ticket_number) => request('POST', '/auth/login', { nick_name, ticket_number }),
  adminLogin: (username, password) => request('POST', '/auth/admin/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),

  // Participant dashboard
  getMe: () => request('GET', '/me'),

  // Slots
  getSlots: () => request('GET', '/slots'),
  bookSlot: (id) => request('POST', `/slots/${id}/book`),
  cancelSlot: (id) => request('DELETE', `/slots/${id}/book`),

  // Public
  getLeaderboard: () => request('GET', '/leaderboard'),
  getAllLeaderboard: () => request('GET', '/leaderboard?all=true'),
  getBracket: () => request('GET', '/bracket'),

  // Schedule (public)
  getSchedule: () => request('GET', '/schedule'),

  // Admin
  adminGetTickets: () => request('GET', '/admin/tickets'),
  adminAddTicket: (nick_name, ticket_number) =>
    request('POST', '/admin/tickets', { nick_name, ticket_number }),
  adminDeleteTicket: (id) => request('DELETE', `/admin/tickets/${id}`),
  adminGetSlots: () => request('GET', '/admin/slots'),
  adminUpdateSlot: (id, data) => request('PATCH', `/admin/slots/${id}`, data),
  adminUpdateBracket: (entries) => request('PATCH', '/admin/bracket', { entries }),
  adminGetParticipants: () => request('GET', '/admin/participants'),

  // Admin schedule
  adminGetSchedule: () => request('GET', '/admin/schedule'),
  adminAddScheduleEvent: (time_from, event, time_to) =>
    request('POST', '/admin/schedule', { time_from, time_to, event }),
  adminUpdateScheduleEvent: (id, data) => request('PATCH', `/admin/schedule/${id}`, data),
  adminDeleteScheduleEvent: (id) => request('DELETE', `/admin/schedule/${id}`),

  // Setup
  adminSetupStatus: () => request('GET', '/admin/setup/status'),
  adminMigrate: () => request('POST', '/admin/setup/migrate'),
  adminSeedSlots: (data) => request('POST', '/admin/setup/seed', data),
  adminReschedule: (data) => request('PATCH', '/admin/setup/reschedule', data),
  adminClearSlots: () => request('DELETE', '/admin/setup/slots'),
  adminResetDatabase: () => request('DELETE', '/admin/setup/database', { confirm: 'RESET' }),
};
