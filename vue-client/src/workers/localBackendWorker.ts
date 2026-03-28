type WasmModule = {
  default: (input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module) => Promise<unknown>;
  run_action_async: (action: string, name: string, message: string) => Promise<unknown[]>;
  run_project_action_async: (payloadJson: string) => Promise<unknown>;
};

interface RpcWorkerRequest {
  id: number;
  kind: "rpc";
  action: string;
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

let wasmReady: Promise<WasmModule> | null = null;
const wasmModuleUrl = "/wasm/backend-worker-wasm/backend_worker_wasm.js";
const wasmBinaryUrl = "/wasm/backend-worker-wasm/backend_worker_wasm_bg.wasm";
const runtimeImport = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;
const expectedToken = import.meta.env.VITE_LOCAL_AUTH_TOKEN ?? "dev-token";

async function loadWasmModule(): Promise<WasmModule> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const module = (await runtimeImport(wasmModuleUrl)) as WasmModule;
      await module.default(wasmBinaryUrl);
      return module;
    })();
  }

  return wasmReady;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  try {
    self.postMessage({ id: req.id, type: "started" });
    if (req.token !== expectedToken) {
      throw new Error("unauthorized local-first token");
    }
    const wasmModule = await loadWasmModule();

    if (req.kind === "project") {
      const result = await wasmModule.run_project_action_async(req.payloadJson);
      self.postMessage({ id: req.id, type: "data", line: String(result) });
      self.postMessage({ id: req.id, type: "done" });
      return;
    }

    const result = await wasmModule.run_action_async(req.action, req.name, req.message);
    for (const line of Array.from(result).map((x) => String(x))) {
      self.postMessage({ id: req.id, type: "data", line });
    }
    self.postMessage({ id: req.id, type: "done" });
  } catch (err) {
    self.postMessage({
      id: req.id,
      type: "error",
      error: String(err),
    });
  }
};
