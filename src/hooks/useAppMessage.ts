import { App as AntdApp } from "antd";

export function useAppMessage() {
  const { message } = AntdApp.useApp();

  return message;
}
