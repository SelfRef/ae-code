# Board

The board shows your threads as cards in columns, from an idea to shipped work. Open it with the
**Board** button at the bottom of the sidebar, **Open board** in the command palette, or
`Ctrl+Alt+K` (`Cmd+Alt+K` on macOS). The project menu at the top right shows **All projects** or any
number of projects you tick; **All projects** in the menu resets it. On a narrow window the board
shows one column at a time; pick it from the row of columns above it.

Click a column's header to collapse it into a thin strip with its name and count, and again to open
it. Parked starts collapsed. A card can still be dropped onto a collapsed column. When the columns
do not all fit, the overview at the top (web and desktop) shows where you are: click or drag it to
scroll.

On Android, **Board** is a navigation tab. It starts at the end of the tab list, so it opens from the
top of **Settings** until you move it up in **Settings → Navigation tabs**. Tablets and unfolded phones show the columns side by side; a phone shows one column at a time, picked from the row of columns above it.

A card's column follows what the thread is doing, so it never disagrees with the thread. The
buttons on a card do what the thread itself would: settle, un-settle, wake, merge, open a pull
request.

| Column      | A card is here when                                                         |
| ----------- | --------------------------------------------------------------------------- |
| **Draft**   | It is an unsent new-thread draft, or a thread you have not sent anything to |
| **Working** | The agent is working, or waits for you (**Needs you**)                      |
| **Parked**  | The thread is snoozed (collapsed until you open it)                         |
| **Review**  | The agent finished and the thread is not settled                            |
| **In PR**   | The thread has an open or draft pull request                                |
| **Done**    | The thread is settled                                                       |

## Move a card

The button on the right moves a card forward; the one on the left moves it back.

- **Draft**: click the card to open it in the composer, where you send it.
- **Working**: **Answer** opens a thread that waits for you. A working thread moves on its own.
- **Review**: the next step of shipping the thread's branch.
  - Merging into the default branch: **Commit & merge** with uncommitted changes, **Merge** with
    commits the default branch lacks (or **Merge & push**, per the project's **Default branch
    action**). If the merge hits a conflict, the agent finishes it, as with the thread's own Merge
    button.
  - Pull requests (the project's **Current branch action** is **Push & create pull request**):
    **Commit, push & PR** or **Push & create PR**.
  - **Settle** once there is nothing left to land.
  - **Send back** opens the thread so you can tell the agent what to change.
- **In PR**: **Review PR** opens the pull request, where you merge it. A merged pull request
  settles the thread on its own; **Send back** opens the thread.
- **Done**: **Un-settle** moves the card back to Review.
- **Parked**: **Wake** ends the snooze.

On web and desktop you can also drag a card onto the column its next or previous step leads to:
onto **Done** to settle or merge it, onto **In PR** to open its pull request, onto **Review** to
un-settle or wake it. Dropping it anywhere else does nothing.

Done shows the 20 most recently settled threads; **Show more** lists the rest that are loaded.
