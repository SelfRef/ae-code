import { useAtomValue, useAtomRefresh } from "@effect/atom-react";
import { compareSemverVersions } from "@t3tools/shared/semver";
import { AsyncResult } from "effect/reactivity";

import { requestConfirmDialog } from "~/confirmDialog";
import { usePrimaryEnvironment } from "~/state/environments";
import { npmReleaseAtom, npmReleaseFailureMessage } from "~/state/npmRelease";
import { environmentSession } from "~/state/session";
import { serverEnvironment } from "~/state/server";
import { resolveServerSelfUpdateCapability } from "~/versionSkew";
import { canUpdateServer, ServerUpdateProgress, useServerUpdate } from "../ServerUpdateAction";
import { Button } from "../ui/button";
import { AboutVersionTitle } from "./AboutVersionTitle";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const UPDATES_OFF =
  "Updates from the app are off. In the Docker image, set T3CODE_SELF_UPDATE=true to turn them on.";

/** The version row of a browser tab: the server that serves this page, updated in place. */
export function ServerVersionRow() {
  const primary = usePrimaryEnvironment();
  const serverConfig = primary?.serverConfig ?? null;
  if (primary === null || serverConfig === null) {
    return (
      <SettingsRow
        id={searchableSetting("app-version").id}
        title={<AboutVersionTitle />}
        description="Current version of the application."
      />
    );
  }
  if (resolveServerSelfUpdateCapability(serverConfig) !== "respawn") {
    return (
      <SettingsRow
        id={searchableSetting("app-version").id}
        title={<AboutVersionTitle />}
        description={UPDATES_OFF}
        control={
          <Button size="sm" variant="outline" disabled>
            Check for Updates
          </Button>
        }
      />
    );
  }
  return (
    <UpdatableVersionRow
      environmentId={primary.environmentId}
      serverVersion={serverConfig.environment.serverVersion}
    />
  );
}

function UpdatableVersionRow({
  environmentId,
  serverVersion,
}: {
  readonly environmentId: Parameters<typeof environmentSession.sessionStateAtom>[0];
  readonly serverVersion: string;
}) {
  const release = useAtomValue(npmReleaseAtom("latest"));
  const refresh = useAtomRefresh(npmReleaseAtom("latest"));
  const updateState = useAtomValue(serverEnvironment.updateStateAtom(environmentId));
  const canUpdate = useAtomValue(
    environmentSession.sessionStateAtom(environmentId),
    canUpdateServer,
  );
  const update = useServerUpdate();

  const latest = AsyncResult.isSuccess(release) ? (release.value?.version ?? null) : null;
  const available = latest !== null && compareSemverVersions(latest, serverVersion) > 0;
  const running = updateState.status === "running";

  const install = async () => {
    if (latest === null) return;
    const confirmed = await requestConfirmDialog(
      `Update the server to ${latest}? It restarts and the app reconnects; running turns stop.`,
    );
    if (confirmed === false) return;
    await update({
      environmentId,
      serverLabel: "Server",
      selfUpdate: "respawn",
      targetVersion: latest,
    });
  };

  const description =
    updateState.status !== "idle" ? (
      <ServerUpdateProgress state={updateState} />
    ) : AsyncResult.isFailure(release) ? (
      npmReleaseFailureMessage(release.cause)
    ) : AsyncResult.isInitial(release) || release.waiting ? (
      "Checking for updates…"
    ) : available ? (
      `Update available: ${latest}.`
    ) : (
      "Up to date."
    );

  return (
    <SettingsRow
      id={searchableSetting("app-version").id}
      title={<AboutVersionTitle />}
      description={description}
      control={
        <Button
          size="sm"
          variant="outline"
          disabled={running || (available && !canUpdate)}
          onClick={() => (available ? void install() : refresh())}
        >
          {running ? "Updating…" : available ? "Install" : "Check for Updates"}
        </Button>
      }
    />
  );
}
