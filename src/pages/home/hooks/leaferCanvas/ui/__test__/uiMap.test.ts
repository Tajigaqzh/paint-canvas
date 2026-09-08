import { describe, expect, it } from "vitest";
import type { ManagedNodeUI } from "@/types";
import { findNodeIdByUI } from "../uiMap";

describe("findNodeIdByUI", () => {
  it("命中托管 UI 时返回 nodeId", () => {
    const ui = { id: "ui" } as unknown as ManagedNodeUI;
    const uiMap = new Map<string, ManagedNodeUI>([["n1", ui]]);
    expect(findNodeIdByUI(uiMap, ui)).toBe("n1");
  });

  it("未托管的 UI 返回 undefined", () => {
    const uiMap = new Map<string, ManagedNodeUI>();
    expect(findNodeIdByUI(uiMap, { id: "other" } as never)).toBeUndefined();
  });
});
