import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { SourceControlProviderKind } from "@t3tools/contracts";
import type { IssueProviderApi } from "@t3tools/source-control-core/server/IssueProvider";

import * as BuiltInDrivers from "../sourceControl/builtInDrivers.ts";

export class IssueProviderRegistry extends Context.Service<
  IssueProviderRegistry,
  {
    readonly get: (kind: SourceControlProviderKind) => IssueProviderApi | null;
  }
>()("t3/issue/IssueProviderRegistry") {}

const make = Effect.gen(function* () {
  const drivers = yield* BuiltInDrivers.SourceControlDrivers;
  const byKind = new Map(
    drivers.flatMap(({ instance }) => instance.issues ?? []).map((api) => [api.kind, api]),
  );
  return IssueProviderRegistry.of({ get: (kind) => byKind.get(kind) ?? null });
});

export const layer = Layer.effect(IssueProviderRegistry, make).pipe(
  Layer.provide(BuiltInDrivers.layer),
);
