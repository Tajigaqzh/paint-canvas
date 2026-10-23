import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "..";
import { useAppTranslation } from "../useAppTranslation";

describe("useAppTranslation", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("返回当前语言的翻译函数", async () => {
    await i18n.changeLanguage("en-US");
    const { result } = renderHook(() => useAppTranslation());

    expect(result.current.t("save")).toBe("Save");
  });
});
