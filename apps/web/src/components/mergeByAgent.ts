/** What the thread's agent is told when the built-in merge could not finish and the user hands it over. */
export function mergeByAgentPrompt(input: { readonly push: boolean; readonly error: string }) {
  return [
    `Merging this branch into the default branch${input.push ? " and pushing it" : ""} failed:`,
    "",
    input.error,
    "",
    "Finish the merge yourself:",
    "1. Commit any pending changes in this checkout.",
    "2. Rebase this branch onto the default branch and resolve any conflicts, keeping the intent of both sides. Run the project's checks afterwards.",
    "3. Fast-forward the default branch to this branch (`git merge --ff-only` in the checkout that has the default branch checked out, or `git fetch . <branch>:<default>` when none has).",
    ...(input.push ? ["4. Push the default branch to its remote."] : []),
    "",
    "Keep the history linear: no merge commits, no force-push, and never discard uncommitted work in the default branch's checkout. If a step cannot be done safely, stop and say why.",
  ].join("\n");
}
