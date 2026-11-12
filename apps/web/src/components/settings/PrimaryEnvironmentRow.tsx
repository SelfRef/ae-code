import { resolveEnvironmentMachineKind } from "@t3tools/contracts";
import { connectionStatusText } from "@t3tools/client-runtime/connection";

import type { EnvironmentPresentation } from "~/state/environments";
import { EnvironmentRow } from "./EnvironmentRow";

// The server this page is served by. It is not a saved environment, so the list would otherwise omit it.
export function PrimaryEnvironmentRow({ environment }: { environment: EnvironmentPresentation }) {
  return (
    <EnvironmentRow
      kind={resolveEnvironmentMachineKind(environment.serverConfig)}
      label={environment.label}
      subtitle={[
        environment.displayUrl,
        "This server",
        connectionStatusText(environment.connection),
      ]
        .filter(Boolean)
        .join(" · ")}
    />
  );
}
