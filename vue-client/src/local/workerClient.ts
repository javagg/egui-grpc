export type RpcAction = "Unary" | "ServerStream" | "ClientStream" | "BidiStream";

export type ProjectWorkerAction =
  | {
    action: "create";
    id: string;
    name: string;
    description: string;
    owner_user_id: string;
    member_user_ids: string[];
  }
  | {
    action: "list";
    user_id: string;
  }
  | {
    action: "update";
    user_id: string;
    is_superuser: boolean;
    id: string;
    name: string;
    description: string;
    owner_user_id: string;
    member_user_ids: string[];
  }
  | {
    action: "delete";
    user_id: string;
    is_superuser: boolean;
    id: string;
  };

interface RpcWorkerRequest {
  id: number;
  kind: "rpc";
  action: RpcAction;
  token: string;
  name: string;
  message: string;
}

interface ProjectWorkerRequest {
  id: number;
  kind: "project";
  token: string;
  payloadJson: string;
}

type WorkerRequest = RpcWorkerRequest | ProjectWorkerRequest;

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
  token: string,
  name: string,
  message: string,
): Promise<string[]> {
  return callLocalBackendStream(action, token, name, message);
}

export async function callLocalBackendStream(
  action: RpcAction,
  token: string,
  name: string,
  message: string,
  onLine?: (line: string) => void,
): Promise<string[]> {
  const w = getWorker();
  const id = nextId++;

  const req: WorkerRequest = { id, kind: "rpc", action, token, name, message };

  return new Promise<string[]>((resolve, reject) => {
    pending.set(id, { lines: [], onLine, resolve, reject });
    w.postMessage(req);
  });
}

export async function callLocalProjectBackend(
  token: string,
  payload: ProjectWorkerAction,
): Promise<string> {
  const w = getWorker();
  const id = nextId++;
  const req: WorkerRequest = {
    id,
    kind: "project",
    token,
    payloadJson: JSON.stringify(payload),
  };

  return new Promise<string>((resolve, reject) => {
    pending.set(id, {
      lines: [],
      resolve: (lines) => resolve(lines[0] ?? ""),
      reject,
    });
    w.postMessage(req);
  });
}
