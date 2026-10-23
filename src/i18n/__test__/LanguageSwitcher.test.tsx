import { fireEvent, render, screen } from "@testing-library/react";
import LanguageSwitcher from "../LanguageSwitcher";
import i18n from "..";
import { afterEach, describe, expect, it } from "vitest";

describe("LanguageSwitcher", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("切换语言后更新 i18n 当前语言", () => {
    render(<LanguageSwitcher />);

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("English"));

    expect(i18n.language).toBe("en-US");
  });
});
