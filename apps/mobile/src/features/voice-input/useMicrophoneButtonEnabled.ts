import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { mobilePreferencesAtom } from "../../state/preferences";

/** Whether editors show their microphone button; on unless the device turned it off. */
export function useMicrophoneButtonEnabled(): boolean {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return !AsyncResult.isSuccess(preferences) || preferences.value.microphoneButtonEnabled !== false;
}
