# egui-grpc 技术总结（面向后续 Agent）

## 1. 项目目标与当前状态

本仓库是一个最小可运行的 egui + gRPC（gRPC-Web）示例，满足：

- 服务端：tonic + tonic-web
- 客户端：egui/eframe，编译到 wasm，通过 trunk 在浏览器运行
- 演示模式：Unary / Server Streaming / Client Streaming / Bidirectional Streaming

当前状态：

- workspace 可通过 `cargo check --workspace`
- 客户端可通过 `trunk build`
- 客户端可通过 `trunk serve` 启动

## 2. 目录与职责

- `Cargo.toml`：workspace 根配置（成员：proto/server/client）
- `proto/`：protobuf 定义与 tonic 代码生成
- `server/`：gRPC 服务实现，启用 tonic-web 兼容
- `client/`：egui wasm 客户端与 trunk 页面
- `README.md`：对外运行说明
- `target.md`：原始需求说明

## 3. 关键实现约束（非常重要）

### 3.1 proto 代码生成必须关闭 transport

文件：`proto/build.rs`

必须保留：

- `.build_transport(false)`

原因：

- 默认生成的 client 代码会引用 `tonic::transport::Channel`
- wasm 场景下 client 未启用 tonic transport，会导致 `could not find transport in tonic` 编译失败

### 3.2 trunk 目标必须唯一且显式指定

文件：`client/Cargo.toml`、`client/index.html`

必须保留：

- `[lib] name = "client_wasm"`
- `index.html` 中 `<link data-trunk rel="rust" data-target-name="client_wasm" />`

原因：

- 如果同包存在多个可产出 wasm 的目标且名称冲突/不明确，trunk 会报：
  - `found more than one target artifact`

### 3.3 eframe 0.31 wasm 启动方式

文件：`client/src/lib.rs`

已采用正确调用：

- 通过 DOM 获取 `HtmlCanvasElement`
- `WebRunner::start(canvas, web_options, app_creator)`
- 返回类型使用 `Result<(), JsValue>`

注意：

- 不要把 canvas id 字符串直接传给 `start`
- 不要使用 `eframe::WebError`（该版本下不匹配）

## 4. 端到端数据流

1. 浏览器加载 trunk 产物并执行 wasm 启动函数
2. egui 页面通过按钮触发 RPC 调用
3. wasm 客户端使用 `tonic-web-wasm-client::Client` 发起 gRPC-Web 请求
4. 服务端通过 `tonic_web::enable(service)` 处理 HTTP/1 + gRPC-Web
5. 响应在 UI Logs 区域展示

## 5. 四种 RPC 演示映射

- Unary：`SayHello`
- 服务端流：`ServerStream`
- 客户端流：`ClientStream`
- 双向流：`BidiStream`

对应 proto 文件：`proto/proto/demo.proto`

## 6. 本地运行标准流程（后续 Agent 默认动作）

### 6.1 一次性准备

- 安装 wasm target：`rustup target add wasm32-unknown-unknown`
- 安装 trunk：`cargo install trunk`

### 6.2 启动服务端

在仓库根目录执行：

- `cargo run -p server`

默认监听：`http://127.0.0.1:50051`

### 6.3 启动客户端

在另一个终端执行：

- `cd client`
- `trunk serve`

打开 trunk 输出地址（通常 `http://127.0.0.1:8080`）

## 7. 变更后最小验证清单

后续任何改动后，至少执行：

1. `cargo check -p server`
2. `cargo check -p client --target wasm32-unknown-unknown`
3. `cd client && trunk build`

如果涉及跨 crate 改动，再补：

4. `cargo check --workspace`

## 8. 常见故障与快速修复

### 故障 A：`could not find transport in tonic`

优先检查：

- `proto/build.rs` 是否仍有 `.build_transport(false)`
- client 依赖中 tonic 是否错误开启 transport/channel 相关 feature

### 故障 B：`found more than one target artifact`

优先检查：

- `client/index.html` 是否显式 `data-target-name="client_wasm"`
- `client/Cargo.toml` 的 `[lib] name` 是否为 `client_wasm`
- 是否存在额外 target 导致 trunk 歧义

### 故障 C：eframe wasm 启动类型错误

典型报错：

- `expected HtmlCanvasElement, found &str`

修复方向：

- 在 `client/src/lib.rs` 中先通过 DOM 获取 canvas，再传给 `WebRunner::start`

## 9. 对后续 Agent 的建议

- 优先保持当前最小架构，不要提前引入额外框架或复杂抽象
- 修改 proto 后，必须重新验证 wasm 目标与 trunk build
- 与 wasm 相关的入口变更，优先参考 eframe 当前版本 API，而非旧示例
- 如出现 trunk 异常重建，先确认是否有旧 trunk 进程未退出
