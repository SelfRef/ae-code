import type { EnvironmentId } from "@t3tools/contracts";
import {
  canMoveInto,
  entryName,
  entryNameError,
  entryParent,
  joinEntryPath,
} from "@t3tools/client-runtime/file-entry-paths";
import { ChevronRightIcon, FolderIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";

import { useDirectoryEntries } from "./useDirectoryEntries";

/** Resolves to an error message to keep the dialog open on, or null once the change is done. */
type Submit<T> = (value: T) => Promise<string | null>;

export function EntryNameDialog(props: {
  title: string;
  confirmLabel: string;
  initialName: string;
  siblingNames: readonly string[];
  onSubmit: Submit<string>;
  onClose: () => void;
}) {
  const { initialName, onClose } = props;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const validation = entryNameError(name, props.siblingNames);
  const submit = async () => {
    if (validation !== null || pending) return;
    if (name.trim() === initialName) {
      onClose();
      return;
    }
    setPending(true);
    const message = await props.onSubmit(name.trim());
    setPending(false);
    if (message === null) onClose();
    else setError(message);
  };
  const shownError = error ?? (name === initialName ? null : validation);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPopup>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              aria-label="Name"
              value={name}
              spellCheck={false}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              onFocus={(event) => {
                const dot = initialName.lastIndexOf(".");
                event.currentTarget.setSelectionRange(0, dot > 0 ? dot : initialName.length);
              }}
            />
            {shownError ? (
              <p role="alert" className="mt-2 text-destructive-foreground text-sm">
                {shownError}
              </p>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={validation !== null || pending}>
              {props.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

const folderCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function EntryDestinationDialog(props: {
  environmentId: EnvironmentId;
  cwd: string;
  rootLabel: string;
  mode: "move" | "copy";
  source: { path: string; kind: "file" | "directory" };
  onSubmit: Submit<string>;
  onClose: () => void;
}) {
  const { source } = props;
  const sourceParent = entryParent(source.path);
  const { entries, load, error, loadingDirectories } = useDirectoryEntries(
    props.environmentId,
    props.cwd,
  );
  const [folder, setFolder] = useState(sourceParent);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the browsed folder's listing from the server; load skips folders already read
  useEffect(() => {
    void load(folder);
  }, [folder, load]);

  const folders = entries
    .filter(
      (entry) =>
        entry.kind === "directory" &&
        !entry.ignored &&
        entryParent(entry.path) === folder &&
        canMoveInto(source, entry.path),
    )
    .toSorted((left, right) => folderCollator.compare(left.path, right.path));
  const segments = folder === "" ? [] : folder.split("/");
  const valid = canMoveInto(source, folder) && folder !== sourceParent;
  const verb = props.mode === "move" ? "Move" : "Copy";
  const submit = async () => {
    if (!valid || pending) return;
    setPending(true);
    const failure = await props.onSubmit(joinEntryPath(folder, entryName(source.path)));
    setPending(false);
    if (failure === null) props.onClose();
    else setMessage(failure);
  };
  const enter = (path: string) => {
    setFolder(path);
    setMessage(null);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) props.onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {verb} “{entryName(source.path)}”
          </DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <nav aria-label="Destination folder" className="flex flex-wrap items-center gap-0.5">
            {[props.rootLabel, ...segments].map((label, index) => (
              <span key={segments.slice(0, index).join("/")} className="flex items-center gap-0.5">
                {index > 0 ? (
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
                ) : null}
                <Button
                  type="button"
                  size="compact"
                  variant="ghost"
                  disabled={index === segments.length}
                  onClick={() => enter(segments.slice(0, index).join("/"))}
                >
                  {label}
                </Button>
              </span>
            ))}
          </nav>
          <ul aria-label="Folders" className="mt-2 max-h-64 overflow-y-auto">
            {folders.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => enter(entry.path)}
                >
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{entryName(entry.path)}</span>
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
            {folders.length === 0 ? (
              <li className="px-2 py-1.5 text-muted-foreground text-sm">
                {loadingDirectories.has(folder) ? "Loading…" : "No subfolders"}
              </li>
            ) : null}
          </ul>
          {(message ?? error) ? (
            <p role="alert" className="mt-2 text-destructive-foreground text-sm">
              {message ?? error}
            </p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button type="button" disabled={!valid || pending} onClick={() => void submit()}>
            {verb} here
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
