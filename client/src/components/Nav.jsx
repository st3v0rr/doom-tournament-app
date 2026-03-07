import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LangSwitcher from './LangSwitcher';
const logoSrc = '/logo.png';
import './Nav.css';

export default function Nav() {
  const { auth, logout } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path) => (location.pathname === path ? 'active' : '');

  return (
    <nav className="nav">
      <div className="nav-brand">
        <Link to="/">
          <img src={logoSrc} alt="Doom Turnier" className="nav-logo" />
        </Link>
      </div>
      <div className="nav-right">
        <div className="nav-links">
          {auth?.role === 'participant' && (
            <>
              <Link to="/dashboard" className={isActive('/dashboard')}>
                {t('nav.myProfile')}
              </Link>
              <Link to="/slots" className={isActive('/slots')}>
                {t('nav.slots')}
              </Link>
            </>
          )}
          {auth?.role === 'admin' && (
            <>
              <Link to="/leaderboard" className={isActive('/leaderboard')}>
                {t('nav.leaderboard')}
              </Link>
              <Link to="/bracket" className={isActive('/bracket')}>
                {t('nav.bracket')}
              </Link>
              <Link to="/display" className={isActive('/display')}>
                {t('nav.tvDisplay')}
              </Link>
              <Link to="/admin" className={isActive('/admin')}>
                {t('nav.admin')}
              </Link>
            </>
          )}
        </div>
        <LangSwitcher />
        <button className="nav-logout btn btn-secondary btn-sm" onClick={logout}>
          {t('nav.logout')}
        </button>
      </div>
    </nav>
  );
}
