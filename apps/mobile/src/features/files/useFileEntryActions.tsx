import { useAtomValue } from "@effect/atom-react";
import {
  entryName,
  entryNameError,
  entryParent,
  joinEntryPath,
} from "@t3tools/client-runtime/file-entry-paths";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ProjectEntry, ProjectEntryOperation } from "@t3tools/contracts";
import type { MenuAction } from "@react-native-menu/menu";
import { useState } from "react";

import type { AppBarMenu } from "../../components/ui/AppBar.types";
import * as Dialog from "../../components/ui/Dialog";
import { projectEnvironment } from "../../state/projects";
import { useAtomCommand } from "../../state/use-atom-command";
import { FileEntryDestinationPicker } from "./FileEntryDestinationPicker";

export interface FileEntryTarget {
  readonly path: string;
  readonly kind: ProjectEntry["kind"];
}

const CREATE_ACTIONS: MenuAction[] = [
  { id: "new-file", title: "New file", image: "doc.text" },
  { id: "new-folder", title: "New folder", image: "folder.badge.plus" },
];

const ENTRY_ACTIONS: MenuAction[] = [
  ...CREATE_ACTIONS,
  { id: "rename", title: "Rename", image: "pencil" },
  { id: "move", title: "Move to…", image: "folder" },
  { id: "copy", title: "Copy to…", image: "doc.on.doc" },
  { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
];

export function useFileEntryActions(input: {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
  readonly entries: ReadonlyArray<ProjectEntry>;
  readonly refresh: () => unknown;
  readonly setExpandedPaths: (
    update: (current: ReadonlySet<string>) => ReadonlySet<string>,
  ) => void;
}) {
  const { environmentId, cwd, entries, refresh, setExpandedPaths } = input;
  const modify = useAtomCommand(projectEnvironment.modifyEntry, { reportFailure: false });
  const permitted = useAtomValue(projectEnvironment.modifyEntry.permissionAtom(environmentId));
  const [picking, setPicking] = useState<{
    readonly mode: "move" | "copy";
    readonly source: FileEntryTarget;
  } | null>(null);
  const canModify = permitted && environmentId !== null && cwd !== null;

  const expandFolder = (folder: string) => {
    if (folder === "") return;
    const parts = folder.split("/");
    setExpandedPaths((current) => {
      const next = new Set(current);
      parts.forEach((_, index) => next.add(parts.slice(0, index + 1).join("/")));
      return next;
    });
  };

  const run = async (failureTitle: string, operation: ProjectEntryOperation, expand?: string) => {
    if (environmentId === null || cwd === null) return;
    const result = await modify({ environmentId, input: { cwd, operation } });
    if (result._tag === "Success") {
      if (expand !== undefined) expandFolder(expand);
      void refresh();
      return;
    }
    if (isAtomCommandInterrupted(result)) return;
    const cause = squashAtomCommandFailure(result);
    Dialog.alert(failureTitle, cause instanceof Error ? cause.message : "Try again.");
  };

  const askName = (options: {
    readonly title: string;
    readonly confirmText: string;
    readonly parent: string;
    readonly initialValue: string;
    readonly ignorePath?: string;
    readonly message?: string;
    readonly onName: (name: string) => void;
  }) =>
    Dialog.prompt({
      title: options.title,
      message: options.message,
      placeholder: "Name",
      initialValue: options.initialValue,
      confirmText: options.confirmText,
      onConfirm: (value) => {
        const name = value.trim();
        const error = entryNameError(
          name,
          entries
            .filter(
              (entry) =>
                entryParent(entry.path) === options.parent && entry.path !== options.ignorePath,
            )
            .map((entry) => entryName(entry.path)),
        );
        if (error) askName({ ...options, initialValue: name, message: error });
        else options.onName(name);
      },
    });

  const create = (parent: string, kind: ProjectEntry["kind"]) =>
    askName({
      title: kind === "directory" ? "New folder" : "New file",
      confirmText: "Create",
      parent,
      initialValue: "",
      onName: (name) =>
        void run(
          kind === "directory" ? "Could not create folder" : "Could not create file",
          { type: "create", kind, relativePath: joinEntryPath(parent, name) },
          parent,
        ),
    });

  const rename = (target: FileEntryTarget) => {
    const parent = entryParent(target.path);
    askName({
      title: "Rename",
      confirmText: "Rename",
      parent,
      initialValue: entryName(target.path),
      ignorePath: target.path,
      onName: (name) => {
        if (name === entryName(target.path)) return;
        void run("Could not rename", {
          type: "move",
          from: target.path,
          to: joinEntryPath(parent, name),
        });
      },
    });
  };

  const remove = (target: FileEntryTarget) =>
    Dialog.confirm({
      title: `Delete “${entryName(target.path)}”?`,
      message:
        target.kind === "directory"
          ? "This folder and everything in it will be deleted. This can't be undone."
          : "This can't be undone.",
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => void run("Could not delete", { type: "delete", relativePath: target.path }),
    });

  const createParent = (target: FileEntryTarget | null) =>
    target === null ? "" : target.kind === "directory" ? target.path : entryParent(target.path);

  const onMenuAction = (target: FileEntryTarget | null, id: string) => {
    switch (id) {
      case "new-file":
        return create(createParent(target), "file");
      case "new-folder":
        return create(createParent(target), "directory");
    }
    if (target === null) return;
    switch (id) {
      case "rename":
        return rename(target);
      case "move":
      case "copy":
        return setPicking({ mode: id, source: target });
      case "delete":
        return remove(target);
    }
  };

  const createMenu: AppBarMenu | undefined = canModify
    ? {
        title: "Create",
        icon: "plus",
        items: CREATE_ACTIONS.map((action) => ({
          id: action.id ?? action.title,
          title: action.title,
          icon: action.image,
          onPress: () => onMenuAction(null, action.id ?? ""),
        })),
      }
    : undefined;

  return {
    canModify,
    entryMenuActions: ENTRY_ACTIONS,
    rootMenuActions: CREATE_ACTIONS,
    onMenuAction,
    createMenu,
    picker:
      picking !== null && environmentId !== null && cwd !== null ? (
        <FileEntryDestinationPicker
          environmentId={environmentId}
          cwd={cwd}
          mode={picking.mode}
          source={picking.source}
          onClose={() => setPicking(null)}
          onSubmit={(folder, name) => {
            setPicking(null);
            void run(
              picking.mode === "move" ? "Could not move" : "Could not copy",
              { type: picking.mode, from: picking.source.path, to: joinEntryPath(folder, name) },
              folder,
            );
          }}
        />
      ) : null,
  };
}

export type FileEntryActions = ReturnType<typeof useFileEntryActions>;
