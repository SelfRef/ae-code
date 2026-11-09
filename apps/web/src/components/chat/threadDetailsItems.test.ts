import { describe, expect, it } from "vite-plus/test";

import {
  resolveThreadDetailsVisibility,
  setThreadDetailsItem,
  THREAD_DETAILS_ITEMS,
} from "./threadDetailsItems";

const usage = THREAD_DETAILS_ITEMS.find((item) => item.id === "usage")!;
const servers = THREAD_DETAILS_ITEMS.find((item) => item.id === "servers")!;

describe("thread details items", () => {
  it.each([
    { items: {}, usage: true, context: true },
    { items: { usage: false }, usage: false, context: true },
    { items: { context: false, retired: false }, usage: true, context: false },
  ])("shows every item unless overridden: %o", (row) => {
    const visibility = resolveThreadDetailsVisibility({ threadDetailsItems: row.items });
    expect(visibility.usage).toBe(row.usage);
    expect(visibility.context).toBe(row.context);
    expect(visibility.servers).toBe(true);
  });

  it("stores only choices that differ from the default", () => {
    expect(setThreadDetailsItem({ threadDetailsItems: {} }, usage, false)).toEqual({
      usage: false,
    });
    expect(setThreadDetailsItem({ threadDetailsItems: { usage: false } }, usage, true)).toEqual({});
    expect(setThreadDetailsItem({ threadDetailsItems: { servers: false } }, servers, true)).toEqual(
      {},
    );
  });
});
