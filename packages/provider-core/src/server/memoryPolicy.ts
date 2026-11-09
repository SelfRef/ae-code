export interface MemoryPolicy {
  /** False: sessions get no memory instructions, and the memory tools refuse. */
  readonly enabled: boolean;
  /** Turn off a provider's own memory in new sessions (Claude Code's auto memory), while memory is on. */
  readonly disableNativeMemory: boolean;
}

// Process-wide on purpose: eight adapters build their instructions and options synchronously, and
// threading the setting through each would touch every one. MemoryService publishes the saved
// settings at server start and on every change; until then (tests, tools that embed an adapter
// without it) a provider's own memory is left alone.
let current: MemoryPolicy = { enabled: true, disableNativeMemory: false };

export const getMemoryPolicy = (): MemoryPolicy => current;

export const setMemoryPolicy = (policy: MemoryPolicy): void => {
  current = policy;
};

/** True when a new session should switch off the provider's own memory. */
export const nativeMemoryDisabled = (): boolean => current.enabled && current.disableNativeMemory;
