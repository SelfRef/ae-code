import type { VcsForcePushCommit, VcsForcePushPreview } from "@t3tools/contracts";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";

function CommitList(props: {
  readonly title: string;
  readonly hint: string;
  readonly commits: ReadonlyArray<VcsForcePushCommit>;
  readonly total: number;
}) {
  const hidden = props.total - props.commits.length;
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-medium">
        {props.title} <span className="font-normal text-muted-foreground">({props.total})</span>
      </h3>
      <p className="mb-1.5 text-xs text-muted-foreground">{props.hint}</p>
      <ul className="max-h-40 divide-y divide-border/60 overflow-y-auto rounded-md border">
        {props.commits.map((commit) => (
          <li key={commit.sha} className="flex min-w-0 items-baseline gap-2 px-2.5 py-1.5 text-xs">
            <code className="shrink-0 font-mono text-muted-foreground">
              {commit.sha.slice(0, 7)}
            </code>
            <span className="min-w-0 flex-1 truncate">{commit.subject}</span>
            <span className="shrink-0 text-muted-foreground">{commit.author}</span>
          </li>
        ))}
        {hidden > 0 ? (
          <li className="px-2.5 py-1.5 text-xs text-muted-foreground">and {hidden} more</li>
        ) : null}
      </ul>
    </section>
  );
}

export function ForcePushDialog(props: {
  readonly preview: VcsForcePushPreview | null;
  readonly canWrite: boolean;
  readonly onConfirm: (preview: VcsForcePushPreview) => void;
  readonly onCancel: () => void;
}) {
  const { preview } = props;
  return (
    <Dialog
      open={preview !== null}
      onOpenChange={(open) => {
        if (!open) props.onCancel();
      }}
    >
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Force push {preview?.refName}?</DialogTitle>
          <DialogDescription>
            {preview
              ? `Your branch and ${preview.upstreamRef} have diverged. Pushing replaces ${preview.upstreamRef} with your local commits and deletes the remote-only ones from it. Anyone who pulled them will have to recover.`
              : null}
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <DialogPanel>
            <div className="space-y-4">
              <CommitList
                title={`Deleted from ${preview.upstreamRef}`}
                hint="Only the remote has these."
                commits={preview.upstreamCommits}
                total={preview.upstreamCommitCount}
              />
              <CommitList
                title={`Pushed to ${preview.upstreamRef}`}
                hint="Only this checkout has these."
                commits={preview.localCommits}
                total={preview.localCommitCount}
              />
              <p className="text-xs text-muted-foreground">
                The remote stays at{" "}
                <code className="font-mono">{preview.upstreamSha.slice(0, 7)}</code> until you
                confirm. If someone pushes in the meantime, the push is refused and nothing is
                overwritten.
              </p>
            </div>
          </DialogPanel>
        ) : null}
        <DialogFooter variant="bare">
          <Button variant="outline" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!props.canWrite || preview === null}
            onClick={() => {
              if (preview) props.onConfirm(preview);
            }}
          >
            Force push
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
