import type { ProviderInstallState, ServerProvider } from "@t3tools/contracts";

/** Providers whose CLI the server installs with npm into the user's `~/.local` prefix. */
const MANAGED_CLI_DRIVERS: ReadonlySet<string> = new Set(["claudeAgent", "opencode"]);

/**
 * The server sets `canInstall` while the CLI is missing or a managed copy fails to start (an
 * interrupted install), and withholds it for a custom path or Windows. `installed` is not checked:
 * a half-installed launcher counts as installed to the probe, and the row must outlive it.
 */
export function canOfferManagedCliInstall(provider: ServerProvider | undefined): boolean {
  return (
    provider !== undefined &&
    MANAGED_CLI_DRIVERS.has(provider.driver) &&
    provider.setup?.canInstall === true
  );
}

export function describeManagedCliInstall(input: {
  readonly cliName: string;
  readonly installation: ProviderInstallState | null;
}) {
  const { cliName, installation } = input;
  const running = installation?.phase === "installing";
  const retry = installation?.phase === "failed" || installation?.phase === "cancelled";
  return {
    running,
    cancelOperationId: running ? installation.operationId : null,
    buttonLabel: retry ? "Retry installation" : `Install ${cliName}`,
    statusText:
      installation === null
        ? "Checking installation status."
        : running
          ? `Installing ${cliName}. This can take a minute.`
          : retry
            ? (installation.message ??
              (installation.phase === "failed"
                ? "Installation failed."
                : "Installation cancelled."))
            : `${cliName} is not installed.`,
    failed: installation?.phase === "failed",
  };
}
