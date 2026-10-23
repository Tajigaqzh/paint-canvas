import i18n from "..";
import { afterEach, describe, expect, it } from "vitest";
import { translateKey } from "..";

describe("i18n", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("中文语言下保留中文界面文案", async () => {
    await i18n.changeLanguage("zh-CN");

    expect(i18n.t("save")).toBe("保存");
  });

  it("英文语言下翻译界面文案", async () => {
    await i18n.changeLanguage("en-US");

    expect(i18n.t("save")).toBe("Save");
  });

  it("英文语言下插值动态文案", async () => {
    await i18n.changeLanguage("en-US");

    expect(i18n.t("countElements", { count: 3 })).toBe("3 elements");
  });

  it("通过英文小驼峰 key 翻译动态文案", async () => {
    await i18n.changeLanguage("en-US");

    expect(translateKey("pageNumber", { count: 2 })).toBe("Page 2");
  });
});
