import {
  isAtomCommandInterrupted,
  settlePromise,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { useRef, useState } from "react";

import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { describeManagedCliInstall } from "./ManagedCliInstallSection.logic";
import { SettingsRow } from "./settingsLayout";

/** Install row for a provider whose CLI is missing and can be installed by the server. */
export function ManagedCliInstallSection({
  environmentId,
  instanceId,
  cliName,
}: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly cliName: string;
}) {
  const target = { environmentId, input: { instanceId } };
  const installQuery = useEnvironmentQuery(serverEnvironment.providerInstallState(target));
  const commandOptions = { reportFailure: false, reportDefect: false };
  const startInstall = useAtomCommand(serverEnvironment.startProviderInstall, commandOptions);
  const cancelInstall = useAtomCommand(serverEnvironment.cancelProviderInstall, commandOptions);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const install = describeManagedCliInstall({ cliName, installation: installQuery.data });
  const disabled = pending || installQuery.error !== null;
  const shownError = error ?? installQuery.error;

  async function run(request: () => Promise<AtomCommandResult<unknown, unknown>>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    const settled = await settlePromise(request);
    pendingRef.current = false;
    setPending(false);
    if (settled._tag === "Failure") {
      setError("Installation failed. Try again.");
    } else if (settled.value._tag === "Failure" && !isAtomCommandInterrupted(settled.value)) {
      const failure = squashAtomCommandFailure(settled.value);
      setError(failure instanceof Error ? failure.message : "Installation failed.");
    }
  }

  return (
    <SettingsRow
      title="Install"
      description={`Install ${cliName} for the user that runs this environment.`}
      status={
        shownError ? (
          <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">
            {shownError}
          </p>
        ) : null
      }
      control={
        <div className="flex w-full min-w-0 flex-col gap-2 @min-[32rem]/settings-row:w-56 @min-[32rem]/settings-row:text-right">
          <p
            role="status"
            className={
              install.failed
                ? "text-xs text-destructive [overflow-wrap:anywhere]"
                : "text-xs text-muted-foreground [overflow-wrap:anywhere]"
            }
          >
            {install.statusText}
          </p>
          {install.running ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || install.cancelOperationId === null}
              onClick={() => {
                const operationId = install.cancelOperationId;
                if (operationId === null) return;
                void run(() =>
                  cancelInstall({ environmentId, input: { instanceId, operationId } }),
                );
              }}
            >
              Cancel installation
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => void run(() => startInstall(target))}
            >
              {install.buttonLabel}
            </Button>
          )}
        </div>
      }
    />
  );
}
