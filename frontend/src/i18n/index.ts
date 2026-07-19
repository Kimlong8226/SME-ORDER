import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './zh.json';
import enTranslation from './en.json';

const savedLang = localStorage.getItem('app_lang') || 'zh';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zhTranslation },
      en: { translation: enTranslation }
    },
    lng: savedLang,
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
