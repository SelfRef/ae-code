import { it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { describe, expect } from "vite-plus/test";

import { withRepositoryLock } from "./mergeLock.ts";

const lock = (key: string, owner: string | null, waiting?: Deferred.Deferred<string | null>) =>
  withRepositoryLock({
    key,
    owner,
    waiting: (holder) =>
      waiting === undefined ? Effect.void : Deferred.succeed(waiting, holder).pipe(Effect.asVoid),
    resumed: Effect.void,
  });

describe("withRepositoryLock", () => {
  it.effect("lets the holding thread in again and stays held until its last hold ends", () =>
    Effect.gen(function* () {
      const innerIn = yield* Deferred.make<void>();
      const innerOut = yield* Deferred.make<void>();
      const outer = yield* Effect.gen(function* () {
        // The hand-off agent's own merge runs on another fiber while the outer hold waits for it.
        yield* Effect.forkDetach(
          Deferred.succeed(innerIn, undefined).pipe(
            Effect.andThen(Deferred.await(innerOut)),
            lock("reenter", "thread-a"),
          ),
        );
        yield* Deferred.await(innerIn);
      }).pipe(lock("reenter", "thread-a"), Effect.forkChild);
      yield* Fiber.join(outer);

      const waiting = yield* Deferred.make<string | null>();
      const other = yield* Effect.void.pipe(lock("reenter", "thread-b", waiting), Effect.forkChild);
      expect(yield* Deferred.await(waiting)).toBe("thread-a");
      yield* Deferred.succeed(innerOut, undefined);
      yield* Fiber.join(other);
    }),
  );

  it.effect("frees the lock when the holder is interrupted or fails", () =>
    Effect.gen(function* () {
      const held = yield* Deferred.make<void>();
      const holder = yield* Deferred.succeed(held, undefined).pipe(
        Effect.andThen(Effect.never),
        lock("release", null),
        Effect.forkChild,
      );
      yield* Deferred.await(held);
      const waiting = yield* Deferred.make<string | null>();
      const waiter = yield* Effect.fail("boom").pipe(
        lock("release", null, waiting),
        Effect.flip,
        Effect.forkChild,
      );
      yield* Deferred.await(waiting);
      yield* Fiber.interrupt(holder);
      expect(yield* Fiber.join(waiter)).toBe("boom");
      yield* Effect.void.pipe(lock("release", "thread-a"));
    }),
  );
});
