import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import es from './translations/es';
import en from './translations/en';

const translations = { es, en };

export const i18n = new I18n(translations);
i18n.defaultLocale = 'es';
i18n.enableFallback = true;
i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'es';

export const t = (key: string): string => i18n.t(key);
