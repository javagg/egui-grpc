# Vue Client

## Run

1. Start server in repo root:
   - `cargo run -p server`
2. Start Vue client:
   - `cd vue-client`
   - `npm install`
   - `npm run dev`

Default dev URL: `http://127.0.0.1:5173`

## Local First Mode (Worker + Rust WASM)

1. Install `wasm-pack` if needed:
   - `cargo install wasm-pack`
2. Generate worker wasm package:
   - `npm run build:local-backend-wasm`
3. Start local-first dev mode:
   - `npm run dev:local`

In the UI, switch `Mode` to `Local First (Worker + WASM)`.

In this mode:

- Rust business logic runs inside browser Web Worker
- gRPC network communication is replaced by `postMessage`
- server process is not required for action execution
- Worker protocol is event-based: `started` -> multiple `data` -> `done` (or `error`)
- UI receives each `data` event incrementally to mimic streaming behavior

## Build

- `npm run build`
- Output directory: `dist/`

If you want production build with local wasm assets refreshed first:

- `npm run build:local`

## E2E Tests (Local First)

Run local-first end-to-end tests:

- `npm run test:e2e`

Run only remote surrealdb roundtrip e2e:

- `npm run test:e2e:remote-db`

Run in headed mode:

- `npm run test:e2e:headed`

Coverage in current suite:

- Unary in local-first mode
- Unary in local-first mode + SurrealDB IndexedDB roundtrip (`db-test:*`)
- ServerStream in local-first mode (5 chunks + completion)
- BidiStream in local-first mode (3 chunks + completion)
- Remote mode unary + Rust business surrealdb write/read roundtrip
