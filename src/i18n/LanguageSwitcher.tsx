import { Select } from "antd";
import { useAppTranslation } from "@/i18n/useAppTranslation";

export default function LanguageSwitcher() {
  const { i18n } = useAppTranslation();

  return (
    <Select
        size={"small"}
      aria-label={i18n.language.startsWith("zh") ? "切换语言" : "Change language"}
      value={i18n.language.startsWith("zh") ? "zh-CN" : "en-US"}
      options={[
        { label: "简体中文", value: "zh-CN" },
        { label: "English", value: "en-US" },
      ]}
      style={{ width: 124 }}
      onChange={(language: string) => void i18n.changeLanguage(language)}
    />
  );
}
