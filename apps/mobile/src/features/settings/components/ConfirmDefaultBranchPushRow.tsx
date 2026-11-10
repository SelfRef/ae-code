import { useAtomSet } from "@effect/atom-react";

import { useConfirmPushToDefaultBranch } from "../../threads/git/useConfirmPushToDefaultBranch";
import { updateMobilePreferencesAtom } from "../../../state/preferences";
import { SettingsSwitchRow } from "./SettingsSwitchRow";

export function ConfirmDefaultBranchPushRow() {
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  return (
    <SettingsSwitchRow
      icon="exclamationmark.triangle"
      label="Confirm pushing to the default branch"
      subtitle="Ask before pushing, or opening a pull request, from the default branch."
      value={useConfirmPushToDefaultBranch()}
      onValueChange={(value) => savePreferences({ confirmPushToDefaultBranch: value })}
    />
  );
}
