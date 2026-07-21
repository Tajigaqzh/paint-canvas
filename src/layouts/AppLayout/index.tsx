import { App as AntdApp, ConfigProvider, type ThemeConfig } from "antd";
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
  return (
    <ConfigProvider componentSize="large" theme={antdTheme}>
      <AntdApp>
        <Outlet />
      </AntdApp>
    </ConfigProvider>
  );
}

export default AppLayout;
