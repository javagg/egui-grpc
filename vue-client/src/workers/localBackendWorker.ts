type WasmModule = {
  default: (input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module) => Promise<unknown>;
  run_action: (action: string, name: string, message: string) => unknown[];
};

interface WorkerRequest {
  id: number;
  action: string;
  name: string;
  message: string;
}

let wasmReady: Promise<WasmModule> | null = null;
const wasmModuleUrl = "/wasm/backend-worker-wasm/backend_worker_wasm.js";
const wasmBinaryUrl = "/wasm/backend-worker-wasm/backend_worker_wasm_bg.wasm";
const runtimeImport = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;

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
    const wasmModule = await loadWasmModule();
    const result = wasmModule.run_action(req.action, req.name, req.message);
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
