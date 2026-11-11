import { it, expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";

import { withWorkspaceLease, withoutWorkspaceLease } from "./workspaceLease.ts";

it.effect("lets another holder in while the lease is given back, then takes it again", () =>
  Effect.gen(function* () {
    const cwd = "/tmp/lease-test";
    const otherHeld = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const first = yield* withWorkspaceLease(
      cwd,
      withoutWorkspaceLease(cwd, Deferred.await(otherHeld)).pipe(
        Effect.andThen(Deferred.await(release)),
      ),
    ).pipe(Effect.forkChild);
    yield* withWorkspaceLease(cwd, Deferred.succeed(otherHeld, undefined));
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(first);

    // Taken again after the wait: a later holder is not let in alongside.
    const order: Array<string> = [];
    const gate = yield* Deferred.make<void>();
    const holder = yield* withWorkspaceLease(
      cwd,
      withoutWorkspaceLease(cwd, Effect.void).pipe(
        Effect.andThen(Deferred.await(gate)),
        Effect.andThen(Effect.sync(() => order.push("holder done"))),
      ),
    ).pipe(Effect.forkChild);
    const waiter = yield* withWorkspaceLease(
      cwd,
      Effect.sync(() => order.push("waiter")),
    ).pipe(Effect.forkChild);
    yield* Deferred.succeed(gate, undefined);
    yield* Fiber.join(holder);
    yield* Fiber.join(waiter);
    expect(order).toEqual(["holder done", "waiter"]);
  }),
);
