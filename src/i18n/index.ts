import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-US";
import zhCN from "./locales/zh-CN";

void i18n.use(initReactI18next).init({
  fallbackLng: "zh-CN",
  // TODO: 按功能域将语言包迁移为嵌套 key，并同步更新翻译调用后启用点分隔查找。
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  lng:
    typeof localStorage === "undefined"
      ? "zh-CN"
      : (localStorage.getItem("paint-canvas:language") ?? "zh-CN"),
  resources: {
    "zh-CN": { translation: zhCN },
    "en-US": { translation: enUS },
  },
});

i18n.on("languageChanged", (language) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("paint-canvas:language", language);
  }
});

export const translateKey = (key: string, options?: Record<string, unknown>) =>
  String(i18n.t(key, options as never));

export default i18n;
