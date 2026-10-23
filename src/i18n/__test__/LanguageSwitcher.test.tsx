import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LanguageSwitcher from "../LanguageSwitcher";
import i18n from "..";
import { afterEach, describe, expect, it } from "vitest";

describe("LanguageSwitcher", () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
  });

  it("切换语言后更新 i18n 当前语言", async () => {
    render(<LanguageSwitcher />);

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("combobox"));
    });
    const englishOption = await screen.findByText("English");

    await act(async () => {
      fireEvent.click(englishOption);
      await waitFor(() => expect(i18n.language).toBe("en-US"));
    });

    expect(i18n.language).toBe("en-US");
  });
});
