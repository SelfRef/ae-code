type StartRename = () => void;

let registeredStartRename: StartRename | null = null;

/** The thread header's inline rename, for menus elsewhere on the page. */
export function registerThreadRename(handler: StartRename): () => void {
  registeredStartRename = handler;
  return () => {
    if (registeredStartRename === handler) registeredStartRename = null;
  };
}

export function requestThreadRename() {
  registeredStartRename?.();
}
