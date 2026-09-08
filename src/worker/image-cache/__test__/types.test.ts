import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_FETCH_INIT } from "../types";

describe("DEFAULT_IMAGE_FETCH_INIT", () => {
  it("默认 cors 且不带 cookie", () => {
    expect(DEFAULT_IMAGE_FETCH_INIT.mode).toBe("cors");
    expect(DEFAULT_IMAGE_FETCH_INIT.credentials).toBe("omit");
    expect(DEFAULT_IMAGE_FETCH_INIT.cache).toBe("default");
  });
});
