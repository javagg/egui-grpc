export type RpcAction = "Unary" | "ServerStream" | "ClientStream" | "BidiStream";

interface WorkerRequest {
  id: number;
  action: RpcAction;
  name: string;
  message: string;
}

interface WorkerStarted {
  id: number;
  type: "started";
}

interface WorkerData {
  id: number;
  type: "data";
  line: string;
}

interface WorkerDone {
  id: number;
  type: "done";
}

interface WorkerError {
  id: number;
  type: "error";
  error: string;
}

type WorkerResponse = WorkerStarted | WorkerData | WorkerDone | WorkerError;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  {
    lines: string[];
    onLine?: (line: string) => void;
    resolve: (lines: string[]) => void;
    reject: (reason?: unknown) => void;
  }
>();

function getWorker(): Worker {
  if (worker) {
    return worker;
  }

  worker = new Worker(new URL("../workers/localBackendWorker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const data = event.data;
    const entry = pending.get(data.id);
    if (!entry) {
      return;
    }

    if (data.type === "started") {
      return;
    }

    if (data.type === "data") {
      entry.lines.push(data.line);
      entry.onLine?.(data.line);
      return;
    }

    pending.delete(data.id);
    if (data.type === "done") {
      entry.resolve(entry.lines);
      return;
    }

    entry.reject(new Error(data.error));
  };

  worker.onerror = (event) => {
    for (const [id, entry] of pending.entries()) {
      pending.delete(id);
      entry.reject(new Error(event.message || "worker runtime error"));
    }
  };

  return worker;
}

export async function callLocalBackend(
  action: RpcAction,
  name: string,
  message: string,
): Promise<string[]> {
  return callLocalBackendStream(action, name, message);
}

export async function callLocalBackendStream(
  action: RpcAction,
  name: string,
  message: string,
  onLine?: (line: string) => void,
): Promise<string[]> {
  const w = getWorker();
  const id = nextId++;

  const req: WorkerRequest = { id, action, name, message };

  return new Promise<string[]>((resolve, reject) => {
    pending.set(id, { lines: [], onLine, resolve, reject });
    w.postMessage(req);
  });
}
