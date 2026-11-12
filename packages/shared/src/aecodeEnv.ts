const AECODE_PREFIX = "AECODE_";
const T3CODE_PREFIX = "T3CODE_";

/**
 * AE Code names its variables `AECODE_*`, while the code reads upstream's `T3CODE_*`. Every non-empty
 * `AECODE_X` becomes `T3CODE_X`, so it wins over a `T3CODE_X` that is still set (the fallback).
 * Empty values are ignored, so a compose file's `AECODE_X=${AECODE_X}` cannot erase a `T3CODE_X`.
 */
export function applyAecodeEnvAliases(env: NodeJS.ProcessEnv): void {
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith(AECODE_PREFIX) && value) {
      env[T3CODE_PREFIX + name.slice(AECODE_PREFIX.length)] = value;
    }
  }
}

// Importing this module first in an entry point applies the aliases before anything reads the environment.
applyAecodeEnvAliases(process.env);
