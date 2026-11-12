import { describe, expect, it } from "vite-plus/test";

import { applyAecodeEnvAliases } from "./aecodeEnv.ts";

describe("applyAecodeEnvAliases", () => {
  it("maps AECODE_ onto T3CODE_, lets it win, and ignores empty values", () => {
    const env: NodeJS.ProcessEnv = {
      AECODE_PORT: "4000",
      T3CODE_PORT: "3000",
      AECODE_HOST: "",
      T3CODE_HOST: "127.0.0.1",
      T3CODE_HOME: "/old",
      OTHER: "x",
    };
    applyAecodeEnvAliases(env);
    expect(env).toEqual({
      AECODE_PORT: "4000",
      T3CODE_PORT: "4000",
      AECODE_HOST: "",
      T3CODE_HOST: "127.0.0.1",
      T3CODE_HOME: "/old",
      OTHER: "x",
    });
  });
});
