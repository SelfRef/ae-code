import {
  AntigravitySettings,
  CodexSettings,
  ProviderDriverKind,
  type ProviderInstallCancelInput,
  type ProviderInstallState,
  type ProviderInstanceId,
  ProviderSetupError,
  type ProviderSetupInput,
} from "@t3tools/contracts";
import { resolveCommandPath } from "@t3tools/shared/shell";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import * as CodexInstallation from "./CodexInstallation.ts";
import * as NpmPackageInstallation from "./NpmPackageInstallation.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as AntigravityInstallation from "./AntigravityInstallation.ts";
import { deriveProviderInstanceConfigMap } from "./ProviderInstanceRegistryHydration.ts";
import * as ProviderInstanceRegistry from "./ProviderInstanceRegistry.ts";
import * as ProviderRegistry from "./ProviderRegistry.ts";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";
import { findManagedNpmPackage } from "@t3tools/provider-core/server/managedNpmInstall";

const ANTIGRAVITY = ProviderDriverKind.make("antigravity");
const hasBinaryPath = Schema.is(Schema.Struct({ binaryPath: Schema.String }));
const decodeCodexSettings = Schema.decodeUnknownEffect(CodexSettings);
const decodeAntigravitySettings = Schema.decodeUnknownEffect(AntigravitySettings);
const decodeBinaryPathSettings = Schema.decodeUnknownEffect(
  Schema.Struct({ binaryPath: Schema.optional(Schema.String) }),
);

export class ProviderInstallation extends Context.Service<
  ProviderInstallation,
  {
    readonly start: (
      input: ProviderSetupInput,
    ) => Effect.Effect<ProviderInstallState, ProviderSetupError>;
    readonly cancel: (
      input: ProviderInstallCancelInput,
    ) => Effect.Effect<ProviderInstallState, ProviderSetupError>;
    readonly subscribe: (
      input: ProviderSetupInput,
    ) => Stream.Stream<ProviderInstallState, ProviderSetupError>;
    readonly remove: (
      input: ProviderSetupInput,
    ) => Effect.Effect<ProviderInstallState, ProviderSetupError>;
  }
>()("t3/provider/providerInstallation") {}

const make = Effect.fn("makeProviderInstallation")(function* () {
  const antigravityInstallation = yield* AntigravityInstallation.AntigravityInstallation;
  const codexInstallation = yield* CodexInstallation.CodexInstallation;
  const npmInstallation = yield* NpmPackageInstallation.NpmPackageInstallation;
  const instances = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const providers = yield* ProviderRegistry.ProviderRegistry;
  const settings = yield* ServerSettings.ServerSettingsService;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scope = yield* Effect.scope;
  const accountCheckOperations = new Map<ProviderInstanceId, string>();

  const readEntries = Effect.fn("ProviderInstallation.readEntries")(function* (
    instanceId: ProviderInstanceId,
    operation: string,
  ) {
    const current = yield* settings.getSettings.pipe(
      Effect.mapError(
        () =>
          new ProviderSetupError({
            instanceId,
            operation,
            detail: "Could not read provider installation settings.",
          }),
      ),
    );
    return deriveProviderInstanceConfigMap(current);
  });

  // The driver is validated before a handle is built, so its lookups cannot fail.
  const npmHandle = (driver: ProviderDriverKind) => ({
    start: npmInstallation.start(driver),
    cancel: (operationId: string) => npmInstallation.cancel(driver, operationId),
    state: npmInstallation.state(driver).pipe(Effect.orDie),
    changes: npmInstallation.changes(driver).pipe(Stream.orDie),
    remove: (_protectedPaths?: ReadonlyArray<string>) =>
      Effect.fail(
        new NpmPackageInstallation.NpmPackageInstallationError({
          operation: "remove",
          detail: "Removing this provider's CLI is not available in T3 Code.",
        }),
      ),
  });

  const requireInstance = Effect.fn("ProviderInstallation.requireInstance")(function* (
    instanceId: ProviderInstanceId,
    operation: string,
    managedOnly = false,
  ) {
    const instance = yield* instances.getInstance(instanceId);
    const isCodex = instance?.driverKind === ProviderDriverKind.make("codex");
    const npmPackage = instance ? findManagedNpmPackage(instance.driverKind) : undefined;
    if (!instance || (instance.driverKind !== ANTIGRAVITY && !isCodex && !npmPackage)) {
      return yield* new ProviderSetupError({
        instanceId,
        operation,
        detail: "Managed installation is not available for this provider instance.",
      });
    }
    const installation = isCodex
      ? codexInstallation
      : npmPackage
        ? npmHandle(instance.driverKind)
        : antigravityInstallation;
    const entries = yield* readEntries(instanceId, operation);
    const invalidConfig = () =>
      new ProviderSetupError({
        instanceId,
        operation,
        detail: "The provider instance configuration is invalid.",
      });
    const config = isCodex
      ? yield* decodeCodexSettings(entries[instanceId]?.config ?? {}).pipe(
          Effect.mapError(invalidConfig),
        )
      : npmPackage
        ? yield* decodeBinaryPathSettings(entries[instanceId]?.config ?? {}).pipe(
            Effect.mapError(invalidConfig),
          )
        : yield* decodeAntigravitySettings(entries[instanceId]?.config ?? {}).pipe(
            Effect.mapError(invalidConfig),
          );
    if (isCodex && (!("setupMode" in config) || config.setupMode !== "managed")) {
      return yield* new ProviderSetupError({
        instanceId,
        operation,
        detail: "Choose managed setup to install Codex in T3 Code.",
      });
    }
    const defaultBinary = isCodex ? "codex" : npmPackage?.binary;
    if (managedOnly && config.binaryPath && config.binaryPath.trim() !== defaultBinary) {
      return yield* new ProviderSetupError({
        instanceId,
        operation,
        detail:
          "This instance uses a custom executable. Clear its binary path to manage installation in T3 Code.",
      });
    }
    return { installation, driver: instance.driverKind };
  });

  const failure =
    (instanceId: ProviderInstanceId) =>
    (
      error:
        | AntigravityInstallation.AntigravityInstallationError
        | CodexInstallation.CodexInstallationError
        | NpmPackageInstallation.NpmPackageInstallationError,
    ) =>
      new ProviderSetupError({ instanceId, operation: error.operation, detail: error.detail });

  const start = Effect.fn("ProviderInstallation.start")(function* (input: ProviderSetupInput) {
    const { installation, driver } = yield* requireInstance(input.instanceId, "install", true);
    const started = yield* installation.start.pipe(Effect.mapError(failure(input.instanceId)));
    if (
      driver === ANTIGRAVITY &&
      started.operationId !== null &&
      accountCheckOperations.get(input.instanceId) !== started.operationId
    ) {
      accountCheckOperations.set(input.instanceId, started.operationId);
      // Installation outlives the request and may finish while every client is disconnected.
      yield* installation.changes.pipe(
        Stream.filter(
          (state) =>
            state.operationId !== started.operationId ||
            state.phase === "succeeded" ||
            state.phase === "failed" ||
            state.phase === "cancelled",
        ),
        Stream.runHead,
        Effect.flatMap(
          Effect.fnUntraced(function* (result) {
            if (
              Option.isNone(result) ||
              result.value.operationId !== started.operationId ||
              result.value.phase !== "succeeded"
            )
              return;
            const instance = yield* instances.getInstance(input.instanceId);
            if (
              instance?.driverKind !== ANTIGRAVITY ||
              !instance.enabled ||
              !instance.refreshModels
            )
              return;
            yield* instance.refreshModels().pipe(Effect.ignore({ log: true }));
            yield* providers.refreshInstance(input.instanceId);
          }),
        ),
        Effect.forkIn(scope),
      );
    }
    if (
      findManagedNpmPackage(driver) &&
      started.operationId !== null &&
      accountCheckOperations.get(input.instanceId) !== started.operationId
    ) {
      accountCheckOperations.set(input.instanceId, started.operationId);
      yield* installation.changes.pipe(
        Stream.filter(
          (state) =>
            state.operationId !== started.operationId ||
            state.phase === "succeeded" ||
            state.phase === "failed" ||
            state.phase === "cancelled",
        ),
        Stream.runHead,
        Effect.flatMap(
          Effect.fnUntraced(function* (result) {
            if (
              Option.isNone(result) ||
              result.value.operationId !== started.operationId ||
              result.value.phase !== "succeeded"
            )
              return;
            const installed = yield* instances.listInstances;
            yield* Effect.forEach(
              installed.filter((instance) => instance.driverKind === driver),
              (instance) => providers.refreshInstance(instance.instanceId),
              { discard: true },
            );
          }),
        ),
        Effect.forkIn(scope),
      );
    }
    return started;
  });

  const cancel = Effect.fn("ProviderInstallation.cancel")(function* (
    input: ProviderInstallCancelInput,
  ) {
    const { installation } = yield* requireInstance(input.instanceId, "cancel-install");
    return yield* installation
      .cancel(input.operationId)
      .pipe(Effect.mapError(failure(input.instanceId)));
  });

  const subscribe = (input: ProviderSetupInput) =>
    Stream.unwrap(
      requireInstance(input.instanceId, "observe-install").pipe(
        Effect.map(({ installation }) => installation.changes),
      ),
    );

  const remove = Effect.fn("ProviderInstallation.remove")(function* (input: ProviderSetupInput) {
    const { installation, driver } = yield* requireInstance(
      input.instanceId,
      "remove-install",
      true,
    );
    const entries = yield* readEntries(input.instanceId, "remove-install");
    const protectedPaths = yield* Effect.forEach(
      Object.values(entries),
      Effect.fnUntraced(function* (entry) {
        if (!hasBinaryPath(entry.config) || !entry.config.binaryPath.trim()) {
          return [];
        }
        const binaryPath = entry.config.binaryPath.trim();
        const resolved = yield* resolveCommandPath(binaryPath, {
          env: yield* mergeProviderInstanceEnvironment(entry.environment),
        }).pipe(
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.provideService(Path.Path, path),
        );
        return resolved === null ? [binaryPath] : [binaryPath, resolved];
      }),
    );
    yield* installation
      .remove(protectedPaths.flat())
      .pipe(Effect.mapError(failure(input.instanceId)));
    const allInstances = yield* instances.listInstances;
    yield* Effect.forEach(
      allInstances.filter((instance) => instance.driverKind === driver),
      (instance) => providers.refreshInstance(instance.instanceId),
      { discard: true },
    );
    return yield* installation.state;
  });

  return { start, cancel, subscribe, remove };
});

export const layer = Layer.effect(ProviderInstallation, make());
