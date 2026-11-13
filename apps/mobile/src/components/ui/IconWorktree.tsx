import IconFolder from "@tabler/icons-react-native/IconFolder";
import IconGitBranch from "@tabler/icons-react-native/IconGitBranch";
import type { Icon } from "@tabler/icons-react-native/types";
import { forwardRef } from "react";
import { View } from "react-native";

/** A folder with a small branch badge: reads as "worktree" and stays distinct from the branch icon. */
export const IconWorktree: Icon = forwardRef(({ size = 24, color, strokeWidth, style, testID }) => {
  const box = Number(size);
  return (
    <View style={[{ width: box, height: box }, style as never]} testID={testID}>
      <IconFolder color={color} size={box * 0.9} strokeWidth={strokeWidth} />
      <View style={{ position: "absolute", right: 0, bottom: 0 }}>
        <IconGitBranch color={color} size={box * 0.56} strokeWidth={strokeWidth} />
      </View>
    </View>
  );
});
