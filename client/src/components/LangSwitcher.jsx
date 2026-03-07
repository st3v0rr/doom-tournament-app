import { useTranslation } from 'react-i18next';
import './LangSwitcher.css';

export default function LangSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  const switchTo = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  return (
    <div className="lang-switcher">
      <button
        className={`lang-btn${current === 'de' ? ' active' : ''}`}
        onClick={() => switchTo('de')}
        disabled={current === 'de'}
      >
        DE
      </button>
      <span className="lang-divider">|</span>
      <button
        className={`lang-btn${current === 'en' ? ' active' : ''}`}
        onClick={() => switchTo('en')}
        disabled={current === 'en'}
      >
        EN
      </button>
    </div>
  );
}
