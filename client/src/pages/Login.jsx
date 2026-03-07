import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LangSwitcher from '../components/LangSwitcher';
const logoSrc = '/logo.png';
import './Login.css';

export default function Login() {
  const { auth, login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [nickName, setNickName] = useState('');
  const [nickNameConfirm, setNickNameConfirm] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [ticketNumberConfirm, setTicketNumberConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setTimeout(() => setRateLimitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [rateLimitSeconds]);

  if (auth?.authenticated) {
    navigate(auth.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
  }

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setRateLimitSeconds(0);
    setNickNameConfirm('');
    setTicketNumberConfirm('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRegister) {
      if (nickName !== nickNameConfirm) {
        setError(t('login.errorNicknamesMismatch'));
        return;
      }
      if (ticketNumber !== ticketNumberConfirm) {
        setError(t('login.errorTicketsMismatch'));
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(nickName, nickNameConfirm, ticketNumber, ticketNumberConfirm);
      } else {
        await login(nickName, ticketNumber);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.retryAfter) {
        setRateLimitSeconds(err.retryAfter);
        setError('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-card-top">
          <LangSwitcher />
        </div>
        <div className="login-logo">
          <img src={logoSrc} alt="Doom Turnier" />
        </div>
        <h1>{t('login.title')}</h1>
        <p className="login-subtitle">
          {isRegister ? t('login.subtitleRegister') : t('login.subtitleLogin')}
        </p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className={isRegister ? 'form-segment' : ''}>
            {isRegister && (
              <p className="register-rules">
                {t('login.rules')}
                <br />
                <br />
                {t('login.rulesAllowed')}
              </p>
            )}
            <div className="form-group">
              <label htmlFor="nickName">{t('login.nickname')}</label>
              <input
                id="nickName"
                className="input"
                type="text"
                placeholder={t('login.nicknamePlaceholder')}
                value={nickName}
                onChange={(e) => setNickName(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_\-.]{3,30}"
                title="Buchstaben, Zahlen, _ - . erlaubt (3–30 Zeichen)"
                autoComplete="given-name"
              />
            </div>
            {isRegister && (
              <div className="form-group">
                <label htmlFor="nickNameConfirm">{t('login.nicknameConfirm')}</label>
                <input
                  id="nickNameConfirm"
                  className="input"
                  type="text"
                  placeholder={t('login.nicknameConfirmPlaceholder')}
                  value={nickNameConfirm}
                  onChange={(e) => setNickNameConfirm(e.target.value)}
                  required
                  minLength={3}
                  maxLength={30}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
          <div className={isRegister ? 'form-segment' : ''}>
            {isRegister && <p className="input-hint">{t('login.ticketHint')}</p>}
            <div className="form-group">
              <label htmlFor="ticketNumber">{t('login.ticketNumber')}</label>
              <input
                id="ticketNumber"
                className="input"
                type="text"
                placeholder="12345"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                pattern="\d{5}"
                required
                inputMode="numeric"
              />
            </div>
            {isRegister && (
              <div className="form-group">
                <label htmlFor="ticketNumberConfirm">{t('login.ticketConfirm')}</label>
                <input
                  id="ticketNumberConfirm"
                  className="input"
                  type="text"
                  placeholder="12345"
                  value={ticketNumberConfirm}
                  onChange={(e) =>
                    setTicketNumberConfirm(e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  maxLength={5}
                  pattern="\d{5}"
                  required
                  inputMode="numeric"
                />
              </div>
            )}
          </div>
          {error && <p className="error-msg">{error}</p>}
          {rateLimitSeconds > 0 && (
            <div className="rate-limit-notice">
              <span className="rate-limit-timer">{rateLimitSeconds}s</span>
              {t('common.rateLimitNotice')}
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || rateLimitSeconds > 0}
            style={{ width: '100%' }}
          >
            {loading
              ? isRegister
                ? t('login.registering')
                : t('login.loggingIn')
              : rateLimitSeconds > 0
                ? t('common.waiting', { seconds: rateLimitSeconds })
                : isRegister
                  ? t('login.register')
                  : t('login.login')}
          </button>
        </form>
        <div className="login-mode-switch">
          {isRegister ? (
            <>
              {t('login.alreadyRegistered')}{' '}
              <button className="btn-link" onClick={() => switchMode('login')}>
                {t('login.switchToLogin')}
              </button>
            </>
          ) : (
            <>
              {t('login.noAccount')}{' '}
              <button className="btn-link" onClick={() => switchMode('register')}>
                {t('login.registerNow')}
              </button>
            </>
          )}
        </div>
        <div className="login-links">
          <Link to="/leaderboard">{t('login.leaderboard')}</Link>
          <span>·</span>
          <Link to="/bracket">{t('login.finals')}</Link>
          <span>·</span>
          <Link to="/admin/login">{t('login.admin')}</Link>
        </div>
        <a
          href="https://github.com/st3v0rr/doom-tournament-app"
          target="_blank"
          rel="noopener noreferrer"
          className="login-github-link"
          aria-label="GitHub Repository"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
