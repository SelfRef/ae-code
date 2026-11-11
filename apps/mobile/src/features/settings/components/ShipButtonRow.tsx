import { useAtomSet } from "@effect/atom-react";
import { Platform } from "react-native";

import { useShipButtonEnabled } from "../../threads/git/useShipButtonEnabled";
import { updateMobilePreferencesAtom } from "../../../state/preferences";
import { SettingsSwitchRow } from "./SettingsSwitchRow";

export function ShipButtonRow() {
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const enabled = useShipButtonEnabled();
  if (Platform.OS !== "android") return null;
  return (
    <SettingsSwitchRow
      icon="checkmark.circle"
      label="Commit, merge & settle button"
      subtitle="A button in the thread that commits changes, merges them into the default branch, then settles the thread."
      value={enabled}
      onValueChange={(value) => savePreferences({ shipButtonEnabled: value })}
    />
  );
}
