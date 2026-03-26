# egui + gRPC (tonic/tonic-web) 示例

这个项目演示了一个 client-server 架构：
- 服务端：`tonic` + `tonic-web`
- 客户端1：`egui/eframe`，支持编译为 wasm，并通过 `trunk` 在浏览器运行
- 客户端2：`Vue3 + TypeScript`，通过 `Vite` 运行与构建
- gRPC 消息模式：Unary / Server Streaming / Client Streaming / Bidirectional Streaming

## 目录结构

- `proto/`：共享 protobuf 与生成代码
- `server/`：gRPC 服务实现
- `client/`：egui 客户端（可 web 运行）
- `vue-client/`：Vue3 + TypeScript + Vite 客户端

## 先决条件

1. 安装 Rust（建议 stable）
2. 安装 wasm target：
   - `rustup target add wasm32-unknown-unknown`
3. 安装 trunk：
   - `cargo install trunk`

## 启动服务端

在项目根目录执行：

```bash
cargo run -p server
```

默认监听：`http://127.0.0.1:50051`

## 启动 Web 客户端

在另一个终端执行：

```bash
cd client
trunk serve
```

打开 trunk 输出的地址（通常是 `http://127.0.0.1:8080`）。

## 启动 Vue3 + TypeScript 客户端（Vite）

在另一个终端执行：

```bash
cd vue-client
npm install
npm run dev
```

打开 Vite 输出地址（通常是 `http://127.0.0.1:5173`）。

生产构建：

```bash
cd vue-client
npm run build
```

## Vue Local First 模式（Web Worker + Rust WASM）

该模式下，Vue 客户端不通过 gRPC 网络调用，而是通过 Web Worker + `postMessage`
调用编译成 wasm 的 Rust 后端业务逻辑。

### 一次性准备

安装 wasm-pack（如果未安装）：

```bash
cargo install wasm-pack
```

### 生成本地 wasm 后端

```bash
cd vue-client
npm run build:local-backend-wasm
```

会在 `vue-client/public/wasm/backend-worker-wasm/` 生成 Worker 需要的 wasm 资源。

### 启动本地优先模式

```bash
cd vue-client
npm run dev:local
```

页面中将 `Mode` 切换到 `Local First (Worker + WASM)` 即可。

## 在页面中测试

1. 保持 `Server endpoint` 为 `http://127.0.0.1:50051`
2. 依次点击按钮：
   - `Unary`
   - `Server Stream`
   - `Client Stream`
   - `Bidirectional Stream`
3. 在 `Logs` 区域观察每种模式的返回结果

## 额外说明

- 服务端启用了 `tonic_web::enable` 与宽松 CORS，便于浏览器直接访问。
- 客户端在 wasm 下使用 `tonic-web-wasm-client` 发起 gRPC-Web 请求。
