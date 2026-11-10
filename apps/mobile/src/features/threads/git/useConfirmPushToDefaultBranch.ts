import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { mobilePreferencesAtom } from "../../../state/preferences";

/** Whether pushing from the default branch asks first; on unless the device turned it off. */
export function useConfirmPushToDefaultBranch(): boolean {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return (
    !AsyncResult.isSuccess(preferences) || preferences.value.confirmPushToDefaultBranch !== false
  );
}
