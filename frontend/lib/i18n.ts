import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";
import de from "../locales/de.json";
import pt from "../locales/pt.json";
import it from "../locales/it.json";
import nl from "../locales/nl.json";
import ru from "../locales/ru.json";
import pl from "../locales/pl.json";
import tr from "../locales/tr.json";
import ar from "../locales/ar.json";
import he from "../locales/he.json";
import hi from "../locales/hi.json";
import bn from "../locales/bn.json";
import ur from "../locales/ur.json";
import ja from "../locales/ja.json";
import zh from "../locales/zh.json";
import zh_TW from "../locales/zh-TW.json";
import ko from "../locales/ko.json";
import vi from "../locales/vi.json";
import th from "../locales/th.json";
import id from "../locales/id.json";
import ms from "../locales/ms.json";
import tl from "../locales/tl.json";
import sw from "../locales/sw.json";
import af from "../locales/af.json";
import el from "../locales/el.json";
import cs from "../locales/cs.json";
import sk from "../locales/sk.json";
import ro from "../locales/ro.json";
import hu from "../locales/hu.json";
import sv from "../locales/sv.json";
import no from "../locales/no.json";
import da from "../locales/da.json";
import fi from "../locales/fi.json";
import uk from "../locales/uk.json";
import hr from "../locales/hr.json";
import sr from "../locales/sr.json";
import bg from "../locales/bg.json";

export const LANGUAGE_CODES: Record<string, string> = {
  "English": "en",
  "Spanish": "es",
  "French": "fr",
  "German": "de",
  "Portuguese": "pt",
  "Italian": "it",
  "Dutch": "nl",
  "Russian": "ru",
  "Polish": "pl",
  "Turkish": "tr",
  "Arabic": "ar",
  "Hebrew": "he",
  "Hindi": "hi",
  "Bengali": "bn",
  "Urdu": "ur",
  "Japanese": "ja",
  "Chinese (Simplified)": "zh",
  "Chinese (Traditional)": "zh-TW",
  "Korean": "ko",
  "Vietnamese": "vi",
  "Thai": "th",
  "Indonesian": "id",
  "Malay": "ms",
  "Tagalog": "tl",
  "Swahili": "sw",
  "Afrikaans": "af",
  "Greek": "el",
  "Czech": "cs",
  "Slovak": "sk",
  "Romanian": "ro",
  "Hungarian": "hu",
  "Swedish": "sv",
  "Norwegian": "no",
  "Danish": "da",
  "Finnish": "fi",
  "Ukrainian": "uk",
  "Croatian": "hr",
  "Serbian": "sr",
  "Bulgarian": "bg",
};

i18n.use(initReactI18next).init({
  resources: {
    "en": { translation: en },
    "es": { translation: es },
    "fr": { translation: fr },
    "de": { translation: de },
    "pt": { translation: pt },
    "it": { translation: it },
    "nl": { translation: nl },
    "ru": { translation: ru },
    "pl": { translation: pl },
    "tr": { translation: tr },
    "ar": { translation: ar },
    "he": { translation: he },
    "hi": { translation: hi },
    "bn": { translation: bn },
    "ur": { translation: ur },
    "ja": { translation: ja },
    "zh": { translation: zh },
    "zh-TW": { translation: zh_TW },
    "ko": { translation: ko },
    "vi": { translation: vi },
    "th": { translation: th },
    "id": { translation: id },
    "ms": { translation: ms },
    "tl": { translation: tl },
    "sw": { translation: sw },
    "af": { translation: af },
    "el": { translation: el },
    "cs": { translation: cs },
    "sk": { translation: sk },
    "ro": { translation: ro },
    "hu": { translation: hu },
    "sv": { translation: sv },
    "no": { translation: no },
    "da": { translation: da },
    "fi": { translation: fi },
    "uk": { translation: uk },
    "hr": { translation: hr },
    "sr": { translation: sr },
    "bg": { translation: bg },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
