import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstallState,
  type ServerProvider,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  canOfferManagedCliInstall,
  describeManagedCliInstall,
} from "./ManagedCliInstallSection.logic";

const provider = (overrides: Partial<ServerProvider> = {}): ServerProvider => ({
  instanceId: ProviderInstanceId.make("claudeAgent"),
  driver: ProviderDriverKind.make("claudeAgent"),
  enabled: true,
  installed: false,
  version: null,
  status: "error",
  auth: { status: "unknown" },
  setup: { canAuthenticate: false, canInstall: true },
  checkedAt: "2026-04-10T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
  ...overrides,
});

const installation = (overrides: Partial<ProviderInstallState> = {}): ProviderInstallState => ({
  driver: ProviderDriverKind.make("claudeAgent"),
  operationId: "op-1",
  phase: "idle",
  downloadedBytes: 0,
  totalBytes: null,
  version: null,
  installedVersion: null,
  canRemove: false,
  message: null,
  ...overrides,
});

describe("canOfferManagedCliInstall", () => {
  it("offers the install for a managed driver the server says can install, even if the probe counts a half-installed launcher as installed", () => {
    expect(canOfferManagedCliInstall(provider())).toBe(true);
    expect(
      canOfferManagedCliInstall(provider({ driver: ProviderDriverKind.make("opencode") })),
    ).toBe(true);
    expect(canOfferManagedCliInstall(undefined)).toBe(false);
    expect(canOfferManagedCliInstall(provider({ installed: true }))).toBe(true);
    expect(
      canOfferManagedCliInstall(
        provider({ installed: true, setup: { canAuthenticate: false, canInstall: false } }),
      ),
    ).toBe(false);
    expect(
      canOfferManagedCliInstall(provider({ setup: { canAuthenticate: false, canInstall: false } })),
    ).toBe(false);
    expect(canOfferManagedCliInstall(provider({ setup: undefined }))).toBe(false);
    expect(
      canOfferManagedCliInstall(provider({ driver: ProviderDriverKind.make("antigravity") })),
    ).toBe(false);
  });
});

describe("describeManagedCliInstall", () => {
  it.each([
    {
      name: "loading",
      state: null,
      expected: { running: false, buttonLabel: "Install Claude", text: "Checking" },
    },
    {
      name: "idle",
      state: installation(),
      expected: { running: false, buttonLabel: "Install Claude", text: "Claude is not installed." },
    },
    {
      name: "installing",
      state: installation({ phase: "installing" }),
      expected: { running: true, buttonLabel: "Install Claude", text: "Installing Claude." },
    },
    {
      name: "failed",
      state: installation({ phase: "failed", message: "npm was not found." }),
      expected: { running: false, buttonLabel: "Retry installation", text: "npm was not found." },
    },
    {
      name: "cancelled without a message",
      state: installation({ phase: "cancelled" }),
      expected: {
        running: false,
        buttonLabel: "Retry installation",
        text: "Installation cancelled.",
      },
    },
  ])("describes $name", ({ state, expected }) => {
    const described = describeManagedCliInstall({ cliName: "Claude", installation: state });
    expect(described.running).toBe(expected.running);
    expect(described.buttonLabel).toBe(expected.buttonLabel);
    expect(described.statusText).toContain(expected.text);
  });

  it("only allows cancelling the running operation", () => {
    expect(
      describeManagedCliInstall({
        cliName: "Claude",
        installation: installation({ phase: "installing" }),
      }).cancelOperationId,
    ).toBe("op-1");
    expect(
      describeManagedCliInstall({ cliName: "Claude", installation: installation() })
        .cancelOperationId,
    ).toBeNull();
  });
});
