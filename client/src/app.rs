use std::sync::mpsc::{self, Receiver, Sender};

use eframe::egui;
#[cfg(target_arch = "wasm32")]
use futures_util::{stream, StreamExt};
#[cfg(target_arch = "wasm32")]
use proto::demo::{demo_service_client::DemoServiceClient, HelloRequest};

#[derive(Clone, Copy)]
enum RpcAction {
    Unary,
    ServerStream,
    ClientStream,
    BidiStream,
}

pub struct GrpcDemoApp {
    endpoint: String,
    name: String,
    input_message: String,
    logs: Vec<String>,
    tx: Sender<Vec<String>>,
    rx: Receiver<Vec<String>>,
    busy: bool,
}

impl GrpcDemoApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let (tx, rx) = mpsc::channel();
        Self {
            endpoint: "http://127.0.0.1:50051".to_owned(),
            name: "egui-user".to_owned(),
            input_message: "hello grpc".to_owned(),
            logs: vec!["Ready. Click buttons to run gRPC patterns.".to_owned()],
            tx,
            rx,
            busy: false,
        }
    }

    fn run_action(&mut self, action: RpcAction) {
        if self.busy {
            self.logs.push("A request is already running".to_owned());
            return;
        }

        self.busy = true;
        let tx = self.tx.clone();

        #[cfg(target_arch = "wasm32")]
        {
            let endpoint = self.endpoint.clone();
            let name = self.name.clone();
            let input = self.input_message.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let result = execute_action(action, endpoint, name, input).await;
                let _ = tx.send(result);
            });
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = action;
            let _ = tx.send(vec![
                "This demo client is intended for wasm32 in browser via trunk.".to_owned(),
            ]);
        }
    }
}

impl eframe::App for GrpcDemoApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        while let Ok(mut event_logs) = self.rx.try_recv() {
            self.logs.append(&mut event_logs);
            self.busy = false;
        }

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("egui + gRPC (tonic-web) demo");
            ui.separator();

            ui.horizontal(|ui| {
                ui.label("Server endpoint:");
                ui.text_edit_singleline(&mut self.endpoint);
            });

            ui.horizontal(|ui| {
                ui.label("Name:");
                ui.text_edit_singleline(&mut self.name);
            });

            ui.horizontal(|ui| {
                ui.label("Message:");
                ui.text_edit_singleline(&mut self.input_message);
            });

            ui.separator();
            ui.horizontal_wrapped(|ui| {
                if ui.button("Unary").clicked() {
                    self.run_action(RpcAction::Unary);
                }
                if ui.button("Server Stream").clicked() {
                    self.run_action(RpcAction::ServerStream);
                }
                if ui.button("Client Stream").clicked() {
                    self.run_action(RpcAction::ClientStream);
                }
                if ui.button("Bidirectional Stream").clicked() {
                    self.run_action(RpcAction::BidiStream);
                }
            });

            if self.busy {
                ui.label("Running...");
            }

            ui.separator();
            ui.heading("Logs");
            egui::ScrollArea::vertical().show(ui, |ui| {
                for line in &self.logs {
                    ui.label(line);
                }
            });
        });
    }
}

#[cfg(target_arch = "wasm32")]
async fn execute_action(
    action: RpcAction,
    endpoint: String,
    name: String,
    input: String,
) -> Vec<String> {
    let mut logs = vec![format!("Calling {:?}", action_name(action))];

    let client = tonic_web_wasm_client::Client::new(endpoint.clone());
    let mut grpc = DemoServiceClient::new(client);

    let result = match action {
        RpcAction::Unary => {
            let req = HelloRequest {
                name,
                message: input,
            };
            match grpc.say_hello(req).await {
                Ok(resp) => vec![format!("Unary response: {}", resp.into_inner().message)],
                Err(err) => vec![format!("Unary error: {err}")],
            }
        }
        RpcAction::ServerStream => {
            let req = HelloRequest {
                name,
                message: input,
            };
            match grpc.server_stream(req).await {
                Ok(resp) => {
                    let mut stream = resp.into_inner();
                    let mut out = vec!["Server stream started".to_owned()];
                    while let Some(item) = stream.next().await {
                        match item {
                            Ok(msg) => out.push(format!("-> {}", msg.message)),
                            Err(err) => {
                                out.push(format!("Stream error: {err}"));
                                break;
                            }
                        }
                    }
                    out
                }
                Err(err) => vec![format!("Server stream error: {err}")],
            }
        }
        RpcAction::ClientStream => {
            let payload = vec![
                HelloRequest {
                    name: name.clone(),
                    message: format!("{input} #1"),
                },
                HelloRequest {
                    name: name.clone(),
                    message: format!("{input} #2"),
                },
                HelloRequest {
                    name,
                    message: format!("{input} #3"),
                },
            ];
            match grpc.client_stream(stream::iter(payload)).await {
                Ok(resp) => vec![format!("Client stream response: {}", resp.into_inner().message)],
                Err(err) => vec![format!("Client stream error: {err}")],
            }
        }
        RpcAction::BidiStream => {
            let payload = vec![
                HelloRequest {
                    name: name.clone(),
                    message: format!("{input} A"),
                },
                HelloRequest {
                    name: name.clone(),
                    message: format!("{input} B"),
                },
                HelloRequest {
                    name,
                    message: format!("{input} C"),
                },
            ];

            match grpc.bidi_stream(stream::iter(payload)).await {
                Ok(resp) => {
                    let mut out = vec!["Bidi stream started".to_owned()];
                    let mut stream = resp.into_inner();
                    while let Some(item) = stream.next().await {
                        match item {
                            Ok(msg) => out.push(format!("<- {}", msg.message)),
                            Err(err) => {
                                out.push(format!("Bidi error: {err}"));
                                break;
                            }
                        }
                    }
                    out
                }
                Err(err) => vec![format!("Bidi stream error: {err}")],
            }
        }
    };

    logs.extend(result);
    logs
}

#[cfg(target_arch = "wasm32")]
fn action_name(action: RpcAction) -> &'static str {
    match action {
        RpcAction::Unary => "Unary",
        RpcAction::ServerStream => "ServerStream",
        RpcAction::ClientStream => "ClientStream",
        RpcAction::BidiStream => "BidiStream",
    }
}
