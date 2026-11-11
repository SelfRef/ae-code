import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { mobilePreferencesAtom } from "../../../state/preferences";

/** Whether the thread shows its floating commit, merge and settle button; on unless the device turned it off. */
export function useShipButtonEnabled(): boolean {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return !AsyncResult.isSuccess(preferences) || preferences.value.shipButtonEnabled !== false;
}
