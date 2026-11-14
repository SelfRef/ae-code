import type { MenuView } from "@react-native-menu/menu";
import type { ComponentProps, ReactNode } from "react";
import type { AccessibilityProps } from "react-native";

export type MenuProps = Omit<ComponentProps<typeof MenuView>, "children" | "themeVariant"> &
  Pick<AccessibilityProps, "accessible" | "accessibilityLabel" | "accessibilityRole"> & {
    readonly children: ReactNode;
    /** Leading icon per action id, for icons that are not a symbol. Android only. */
    readonly actionIcons?: Readonly<Record<string, ReactNode>>;
    readonly className?: string;
  };
