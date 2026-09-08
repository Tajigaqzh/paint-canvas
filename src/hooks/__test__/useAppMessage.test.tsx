import { App as AntdApp } from "antd";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useAppMessage } from "../useAppMessage";

const wrapper = ({ children }: { children: ReactNode }) => <AntdApp>{children}</AntdApp>;

describe("useAppMessage", () => {
  it("返回 antd message API", () => {
    const { result } = renderHook(() => useAppMessage(), { wrapper });
    expect(typeof result.current.success).toBe("function");
    expect(typeof result.current.error).toBe("function");
  });
});
