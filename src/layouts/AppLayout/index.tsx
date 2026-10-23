import { App as AntdApp, ConfigProvider, type ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import "@/i18n";
import { Outlet } from "react-router-dom";

const antdTheme: ThemeConfig = {
  token: {
    borderRadius: 8,
    controlHeight: 44,
    fontSize: 15,
  },
  components: {
    Button: {
      controlHeightLG: 46,
      fontSizeLG: 16,
      paddingInlineLG: 18,
    },
    Tabs: {
      cardHeight: 46,
      fontSize: 16,
      titleFontSize: 16,
    },
  },
};

function AppLayout() {
  const { i18n } = useAppTranslation();

  return (
    <ConfigProvider
      componentSize="large"
      locale={i18n.language.startsWith("zh") ? zhCN : enUS}
      theme={antdTheme}
    >
      <AntdApp>
        <Outlet />
      </AntdApp>
    </ConfigProvider>
  );
}

export default AppLayout;
