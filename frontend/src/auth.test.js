import { beforeEach, describe, expect, it } from "vitest";
import { clearToken, getToken, setToken } from "./auth";

describe("auth token helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with no token", () => {
    expect(getToken()).toBeNull();
  });

  it("stores and reads a token", () => {
    setToken("abc.def.ghi");
    expect(getToken()).toBe("abc.def.ghi");
  });

  it("clears the token", () => {
    setToken("x");
    clearToken();
    expect(getToken()).toBeNull();
  });
});
