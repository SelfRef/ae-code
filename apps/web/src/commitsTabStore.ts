import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CommitsView = "list" | "graph";

interface CommitsTabState {
  view: CommitsView;
  /** The branch a Branches row asked the Commits tab for, with the project it belongs to. */
  focus: { readonly projectKey: string; readonly ref: string } | null;
  setView: (view: CommitsView) => void;
  setFocus: (focus: CommitsTabState["focus"]) => void;
}

export const useCommitsTabStore = create<CommitsTabState>()(
  persist(
    (set) => ({
      view: "list",
      focus: null,
      setView: (view) => set({ view }),
      setFocus: (focus) => set({ focus }),
    }),
    {
      name: "t3code:commits-tab:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ view }) => ({ view }),
    },
  ),
);
