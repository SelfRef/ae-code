import type { ReactNode } from "react";
import { ListFilterMenu } from "./ListFilterMenu";

/** A chip that opens a menu of one-of-many choices, like the Pull requests filters. */
export function ChoiceChip<Value extends string>(props: {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly options: ReadonlyArray<{
    readonly value: Value;
    readonly label: string;
    readonly icon?: ReactNode;
  }>;
  /** Shown in the chip, before the label. */
  readonly leading?: ReactNode;
  readonly selected: Value;
  /** Highlights the chip: it is not at its default. */
  readonly active?: boolean;
  readonly onSelect: (value: Value) => void;
}) {
  return (
    <ListFilterMenu
      label={props.label}
      accessibilityLabel={props.accessibilityLabel}
      leading={props.leading}
      actionIcons={Object.fromEntries(
        props.options.flatMap((option) => (option.icon ? [[option.value, option.icon]] : [])),
      )}
      {...(props.active === undefined ? {} : { active: props.active })}
      actions={props.options.map((option) => ({
        id: option.value,
        title: option.label,
        state: option.value === props.selected ? ("on" as const) : ("off" as const),
      }))}
      onSelect={(id) => {
        const option = props.options.find((candidate) => candidate.value === id);
        if (option) props.onSelect(option.value);
      }}
    />
  );
}
