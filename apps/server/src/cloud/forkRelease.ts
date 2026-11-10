import { CLI_RELEASE_REPOSITORY } from "@t3tools/shared/cliRelease";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import * as ProcessRunner from "../processRunner.ts";

/** The image's switch, read by its entrypoint (packaging/docker/entrypoint.sh), not by the server. */
export const SELF_UPDATE_ENV = "T3CODE_SELF_UPDATE";
const RELEASE_ARCHIVE = "ae-code-linux-x64.tar.gz";
const LOOKUP_TIMEOUT = Duration.seconds(15);
const DOWNLOAD_STALL_TIMEOUT = Duration.minutes(1);
const EXTRACT_TIMEOUT = Duration.minutes(5);

export class ForkReleaseError extends Schema.TaggedError<ForkReleaseError>()("ForkReleaseError", {
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    return this.reason;
  }
}

/**
 * Set by the image's entrypoint when SELF_UPDATE_ENV is on: it starts the server again from the
 * newest release in `updates/`. Without it, a server that stopped itself would stay stopped.
 */
export const selfUpdateEnabled = Config.Boolean("T3CODE_UPDATE_SUPERVISED").pipe(
  Config.withDefault(false),
);

/** `v2026.11.09` is `2026.1109.0`, `v2026.11.09.2` is `2026.1109.2`: the version the packages carry. */
function releaseVersionOfTag(tag: string): string | undefined {
  const match = /^v(\d{4})\.(\d{2})\.(\d{2})(?:\.(\d+))?$/.exec(tag);
  if (match === null) return undefined;
  const [, year, month, day, counter] = match;
  return `${year}.${Number(month) * 100 + Number(day)}.${counter ?? 0}`;
}

export interface ForkRelease {
  readonly version: string;
  readonly archiveUrl: string;
  readonly sha256: string;
}

const LatestRelease = Schema.Struct({
  tag_name: Schema.String,
  assets: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      browser_download_url: Schema.String,
      digest: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
});
const decodeLatestRelease = Schema.decodeUnknownEffect(Schema.fromJsonString(LatestRelease));

/** The newest published (not draft, not pre-release) release of the fork on GitHub. */
export const fetchLatestRelease = Effect.fn("cloud.fork_release.fetch_latest")(function* () {
  const http = yield* HttpClient.HttpClient;
  const lookupFailed = (cause: unknown) =>
    new ForkReleaseError({ reason: "Could not read the latest release from GitHub.", cause });
  const body = yield* http
    .execute(
      HttpClientRequest.get(
        `https://api.github.com/repos/${CLI_RELEASE_REPOSITORY}/releases/latest`,
      ).pipe(HttpClientRequest.setHeader("Accept", "application/vnd.github+json")),
    )
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.text),
      Effect.timeout(LOOKUP_TIMEOUT),
      Effect.mapError(lookupFailed),
    );
  const release = yield* decodeLatestRelease(body).pipe(Effect.mapError(lookupFailed));
  const version = releaseVersionOfTag(release.tag_name);
  const asset = release.assets.find((candidate) => candidate.name === RELEASE_ARCHIVE);
  const sha256 = /^sha256:([0-9a-f]{64})$/.exec(asset?.digest ?? "")?.[1];
  if (version === undefined || asset === undefined || sha256 === undefined) {
    return yield* new ForkReleaseError({
      reason: `Release ${release.tag_name} has no verifiable ${RELEASE_ARCHIVE}.`,
    });
  }
  return { version, archiveUrl: asset.browser_download_url, sha256 } satisfies ForkRelease;
});

function updatesDir(path: Path.Path, baseDir: string): string {
  return path.join(baseDir, "updates");
}

/**
 * Downloads and unpacks `release` into `<baseDir>/updates/<version>`, checks that its server runs,
 * and points `<baseDir>/updates/current` at it, which the container entrypoint reads when it
 * starts the server. Older unpacked releases are removed.
 */
export const installRelease = Effect.fn("cloud.fork_release.install")(function* (input: {
  readonly baseDir: string;
  readonly release: ForkRelease;
}) {
  const http = yield* HttpClient.HttpClient;
  const runner = yield* ProcessRunner.ProcessRunner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { release } = input;
  const failed = (step: string) => (cause?: unknown) =>
    new ForkReleaseError({
      reason: `Could not install ${release.version}: ${step}.`,
      ...(cause === undefined ? {} : { cause }),
    });

  const archive = yield* http.execute(HttpClientRequest.get(release.archiveUrl)).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.timeout(DOWNLOAD_STALL_TIMEOUT),
    // A stalled transfer fails; a slow one that keeps sending bytes may take as long as it needs.
    Effect.flatMap((response) =>
      response.stream.pipe(
        Stream.timeoutOrElse({
          duration: DOWNLOAD_STALL_TIMEOUT,
          orElse: () => Stream.fail(new Cause.TimeoutError()),
        }),
        Stream.runCollect,
      ),
    ),
    Effect.mapError(failed("the download failed")),
  );
  const bytes = new Uint8Array(archive.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of archive) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const digest = yield* Effect.tryPromise({
    try: () => crypto.subtle.digest("SHA-256", bytes),
    catch: failed("the checksum could not be computed"),
  });
  if (Hex.encode(new Uint8Array(digest)) !== release.sha256) {
    return yield* failed("the download does not match its checksum")();
  }

  const root = updatesDir(path, input.baseDir);
  const target = path.join(root, release.version);
  yield* fs.makeDirectory(root, { recursive: true }).pipe(Effect.mapError(failed("no state dir")));
  const staging = yield* fs
    .makeTempDirectory({ directory: root, prefix: ".staging-" })
    .pipe(Effect.mapError(failed("no state dir")));
  yield* Effect.gen(function* () {
    const archivePath = path.join(staging, "release.tar.gz");
    yield* fs.writeFile(archivePath, bytes).pipe(Effect.mapError(failed("it could not be saved")));
    const unpacked = path.join(staging, "unpacked");
    yield* fs.makeDirectory(unpacked).pipe(Effect.mapError(failed("it could not be saved")));
    yield* runner
      .run({
        command: "tar",
        args: ["-xzf", archivePath, "-C", unpacked, "--strip-components=1"],
        timeout: EXTRACT_TIMEOUT,
      })
      .pipe(
        Effect.filterOrFail((result) => result.code === 0, failed("it could not be unpacked")),
        Effect.mapError((error) =>
          error instanceof ForkReleaseError ? error : failed("it could not be unpacked")(error),
        ),
      );
    // The unpacked server has to start before anything points at it.
    const check = yield* runner
      .run({
        command: path.join(unpacked, "ae-code"),
        args: ["--version"],
        timeout: LOOKUP_TIMEOUT,
      })
      .pipe(Effect.mapError(failed("its server does not start")));
    if (check.code !== 0 || !check.stdout.includes(release.version)) {
      return yield* failed("its server reports another version")();
    }
    yield* fs.remove(target, { recursive: true, force: true }).pipe(Effect.ignore);
    yield* fs.rename(unpacked, target).pipe(Effect.mapError(failed("it could not be saved")));
    const pointer = path.join(staging, "current");
    yield* fs
      .writeFileString(pointer, `${release.version}\n`)
      .pipe(
        Effect.andThen(fs.rename(pointer, path.join(root, "current"))),
        Effect.mapError(failed("it could not be activated")),
      );
  }).pipe(
    Effect.ensuring(fs.remove(staging, { recursive: true, force: true }).pipe(Effect.ignore)),
  );

  const entries = yield* fs.readDirectory(root).pipe(Effect.orElseSucceed(() => []));
  yield* Effect.forEach(
    entries.filter((entry) => entry !== release.version && entry !== "current"),
    (entry) =>
      fs.remove(path.join(root, entry), { recursive: true, force: true }).pipe(Effect.ignore),
    { discard: true },
  );
  return target;
});
