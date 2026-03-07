export const getLocale = (language) => (language === 'de' ? 'de-DE' : 'en-GB');

export const formatTime = (iso, locale) =>
  new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

export const formatTimeOrDash = (iso, locale) => (iso ? formatTime(iso, locale) : '—');

export const formatDateTimeOrDash = (iso, locale) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
};
