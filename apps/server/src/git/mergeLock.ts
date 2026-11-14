import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";

import type * as GitVcsDriver from "../vcs/GitVcsDriver.ts";

interface RepositoryLock {
  readonly semaphore: Semaphore.Semaphore;
  owner: string | null;
  /** Holds of the current owner; the lock is free again when it drops to 0. */
  depth: number;
}

// In memory on purpose: a restart or crash cannot leave a lock behind.
const repositoryLocks = new Map<string, RepositoryLock>();

/** The repository's common git directory, shared by all of its worktrees. */
export const repositoryLockKey = Effect.fn("GitManager.repositoryLockKey")(function* (
  git: GitVcsDriver.GitVcsDriver["Service"],
  cwd: string,
) {
  const common = yield* git.execute({
    operation: "GitManager.mergeIntoDefault.repository",
    cwd,
    args: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  });
  return common.stdout.trim();
});

/**
 * Runs `effect` holding the repository's merge lock, so merges into the default branch (and a
 * hand-off turn finishing one) run one at a time. Re-entrant for the same `owner` (a thread id),
 * so the agent of the thread holding it can merge from its own hand-off turn; a null owner never
 * re-enters. `waiting` runs once when the lock is held by someone else, `resumed` once it is taken.
 */
export const withRepositoryLock =
  (input: {
    readonly key: string;
    readonly owner: string | null;
    readonly waiting: (holder: string | null) => Effect.Effect<void>;
    readonly resumed: Effect.Effect<void>;
  }) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.uninterruptibleMask((restore) =>
      Effect.suspend(() => {
        const existing = repositoryLocks.get(input.key);
        const lock = existing ?? { semaphore: Semaphore.makeUnsafe(1), owner: null, depth: 0 };
        if (existing === undefined) repositoryLocks.set(input.key, lock);
        const release = Effect.suspend(() => {
          lock.depth -= 1;
          if (lock.depth > 0) return Effect.void;
          lock.owner = null;
          return lock.semaphore.release(1);
        });
        if (input.owner !== null && lock.depth > 0 && lock.owner === input.owner) {
          lock.depth += 1;
          return restore(effect).pipe(Effect.ensuring(release));
        }
        const held = lock.depth > 0;
        const acquire = (held ? input.waiting(lock.owner) : Effect.void).pipe(
          Effect.andThen(lock.semaphore.take(1)),
        );
        return restore(acquire).pipe(
          Effect.andThen(
            Effect.sync(() => {
              lock.owner = input.owner;
              lock.depth = 1;
            }),
          ),
          Effect.andThen(
            restore((held ? input.resumed : Effect.void).pipe(Effect.andThen(effect))).pipe(
              Effect.ensuring(release),
            ),
          ),
        );
      }),
    );
