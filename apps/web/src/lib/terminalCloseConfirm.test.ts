import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { confirmMock, readLocalApiMock } = vi.hoisted(() => {
  const confirmMock = vi.fn<(message: string, options?: unknown) => Promise<boolean>>();
  const readLocalApiMock = vi.fn<
    () =>
      | {
          dialogs: { confirm: (message: string, options?: unknown) => Promise<boolean> };
        }
      | undefined
  >();
  return { confirmMock, readLocalApiMock };
});

const { settingsMock } = vi.hoisted(() => ({
  settingsMock: vi.fn<() => { confirmTerminalClose: "never" | "running" | "always" }>(),
}));

vi.mock("~/hooks/useSettings", () => ({ getClientSettings: () => settingsMock() }));

vi.mock("~/localApi", () => ({
  readLocalApi: () => readLocalApiMock(),
}));

import { confirmTerminalClose, isTerminalCloseConfirmPending } from "./terminalCloseConfirm";

describe("terminal close confirmation", () => {
  beforeEach(() => {
    confirmMock.mockReset();
    readLocalApiMock.mockReset();
    readLocalApiMock.mockReturnValue({ dialogs: { confirm: confirmMock } });
    settingsMock.mockReturnValue({ confirmTerminalClose: "always" });
  });

  it.each([
    ["never", true, false],
    ["running", false, false],
    ["running", true, true],
    ["always", false, true],
  ] as const)("mode %s, running %s: asks %s", async (mode, running, asks) => {
    settingsMock.mockReturnValue({ confirmTerminalClose: mode });
    confirmMock.mockResolvedValue(true);
    await expect(confirmTerminalClose(["Terminal 1"], running)).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(asks ? 1 : 0);
  });

  it("clears pending state and resolves false when the dialog rejects", async () => {
    let reject: (reason?: unknown) => void = () => undefined;
    confirmMock.mockImplementation(
      () =>
        new Promise<boolean>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );

    const confirmation = confirmTerminalClose(["Terminal 1"], true);
    expect(isTerminalCloseConfirmPending()).toBe(true);

    reject(new Error("dialog failed"));
    await expect(confirmation).resolves.toBe(false);
    expect(isTerminalCloseConfirmPending()).toBe(false);
  });
});
