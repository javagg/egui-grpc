use std::pin::Pin;
use std::{collections::HashMap, sync::Arc};

use backend_core::{
    bidi_stream as core_bidi_stream, client_stream as core_client_stream,
    surrealdb_read_test as core_surrealdb_read_test,
    server_stream as core_server_stream, surrealdb_roundtrip_test as core_surrealdb_roundtrip_test,
    unary as core_unary, DemoInput,
};
use futures_core::Stream;
use proto::demo::{
    demo_service_server::{DemoService, DemoServiceServer},
    HelloReply, HelloRequest, LoginReply, LoginRequest, LogoutReply, LogoutRequest,
    RegisterReply, RegisterRequest,
};
use tokio::sync::RwLock;
use tokio_stream::StreamExt;
use tonic::{transport::Server, Request, Response, Status};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

#[derive(Clone)]
struct UserAccount {
    username: String,
    password: String,
    is_superuser: bool,
}

struct DemoGrpcService {
    users: Arc<RwLock<HashMap<String, UserAccount>>>,
    sessions: Arc<RwLock<HashMap<String, String>>>,
}

impl DemoGrpcService {
    fn new(admin_username: String, admin_password: String) -> Self {
        let mut users = HashMap::new();
        users.insert(
            admin_username.clone(),
            UserAccount {
                username: admin_username,
                password: admin_password,
                is_superuser: true,
            },
        );

        Self {
            users: Arc::new(RwLock::new(users)),
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn extract_bearer_token<T>(request: &Request<T>) -> Result<String, Status> {
        let auth = request
            .metadata()
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| Status::unauthenticated("missing authorization header"))?;

        let token = auth
            .strip_prefix("Bearer ")
            .ok_or_else(|| Status::unauthenticated("invalid authorization header format"))?
            .trim();

        if token.is_empty() {
            return Err(Status::unauthenticated("empty bearer token"));
        }

        Ok(token.to_string())
    }

    async fn authorize_token(&self, token: &str) -> Result<(), Status> {
        let sessions = self.sessions.read().await;
        if !sessions.contains_key(token) {
            return Err(Status::unauthenticated("invalid bearer token"));
        }

        Ok(())
    }
}

type ReplyStream = Pin<Box<dyn Stream<Item = Result<HelloReply, Status>> + Send + 'static>>;

#[tonic::async_trait]
impl DemoService for DemoGrpcService {
    async fn register(
        &self,
        request: Request<RegisterRequest>,
    ) -> Result<Response<RegisterReply>, Status> {
        let RegisterRequest { username, password } = request.into_inner();
        if username.trim().is_empty() || password.is_empty() {
            return Err(Status::invalid_argument("username/password must not be empty"));
        }

        let mut users = self.users.write().await;
        if users.contains_key(&username) {
            return Err(Status::already_exists("username already exists"));
        }

        users.insert(
            username.clone(),
            UserAccount {
                username: username.clone(),
                password,
                is_superuser: false,
            },
        );

        let token = Uuid::new_v4().simple().to_string();
        self.sessions
            .write()
            .await
            .insert(token.clone(), username.clone());

        Ok(Response::new(RegisterReply {
            ok: true,
            username,
            token,
            is_superuser: false,
        }))
    }

    async fn login(
        &self,
        request: Request<LoginRequest>,
    ) -> Result<Response<LoginReply>, Status> {
        let LoginRequest { username, password } = request.into_inner();
        if username.trim().is_empty() || password.is_empty() {
            return Err(Status::invalid_argument("username/password must not be empty"));
        }

        let user = {
            let users = self.users.read().await;
            users
                .get(&username)
                .cloned()
                .ok_or_else(|| Status::unauthenticated("invalid username or password"))?
        };

        if user.password != password {
            return Err(Status::unauthenticated("invalid username or password"));
        }

        let token = Uuid::new_v4().simple().to_string();
        self.sessions
            .write()
            .await
            .insert(token.clone(), user.username.clone());

        Ok(Response::new(LoginReply {
            token,
            username: user.username,
            is_superuser: user.is_superuser,
        }))
    }

    async fn logout(
        &self,
        request: Request<LogoutRequest>,
    ) -> Result<Response<LogoutReply>, Status> {
        let token = Self::extract_bearer_token(&request)?;
        let removed = self.sessions.write().await.remove(&token).is_some();

        if !removed {
            return Err(Status::unauthenticated("invalid bearer token"));
        }

        Ok(Response::new(LogoutReply { ok: true }))
    }

    async fn say_hello(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<HelloReply>, Status> {
        let token = Self::extract_bearer_token(&request)?;
        self.authorize_token(&token).await?;
        let HelloRequest { name, message } = request.into_inner();

        if let Some(payload) = message.strip_prefix("db-test:") {
            let db_result = core_surrealdb_roundtrip_test(DemoInput {
                name,
                message: payload.trim().to_string(),
            })
            .await
            .map_err(Status::internal)?;

            return Ok(Response::new(HelloReply { message: db_result }));
        }

        if let Some(payload) = message.strip_prefix("db-read:") {
            let db_result = core_surrealdb_read_test(DemoInput {
                name,
                message: payload.trim().to_string(),
            })
            .await
            .map_err(Status::internal)?;

            return Ok(Response::new(HelloReply { message: db_result }));
        }

        Ok(Response::new(HelloReply {
            message: core_unary(DemoInput {
                name,
                message,
            }),
        }))
    }

    type ServerStreamStream = ReplyStream;

    async fn server_stream(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<Self::ServerStreamStream>, Status> {
        let token = Self::extract_bearer_token(&request)?;
        self.authorize_token(&token).await?;
        let req = request.into_inner();
        let messages = core_server_stream(DemoInput {
            name: req.name,
            message: req.message,
        });

        let stream = async_stream::try_stream! {
            for line in messages {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                yield HelloReply { message: line };
            }
        };

        Ok(Response::new(Box::pin(stream)))
    }

    async fn client_stream(
        &self,
        request: Request<tonic::Streaming<HelloRequest>>,
    ) -> Result<Response<HelloReply>, Status> {
        let token = Self::extract_bearer_token(&request)?;
        self.authorize_token(&token).await?;
        let mut stream = request.into_inner();
        let mut count = 0usize;
        let mut names = Vec::new();

        while let Some(item) = stream.next().await {
            let msg = item?;
            count += 1;
            names.push(DemoInput {
                name: msg.name,
                message: msg.message,
            });
        }

        Ok(Response::new(HelloReply {
            message: if count == 0 {
                core_client_stream(Vec::new())
            } else {
                core_client_stream(names)
            },
        }))
    }

    type BidiStreamStream = ReplyStream;

    async fn bidi_stream(
        &self,
        request: Request<tonic::Streaming<HelloRequest>>,
    ) -> Result<Response<Self::BidiStreamStream>, Status> {
        let token = Self::extract_bearer_token(&request)?;
        self.authorize_token(&token).await?;
        let mut input = request.into_inner();

        let output = async_stream::try_stream! {
            let mut collected = Vec::new();
            while let Some(item) = input.next().await {
                let req = item?;
                collected.push(DemoInput {
                    name: req.name,
                    message: req.message,
                });
            }

            for line in core_bidi_stream(collected) {
                yield HelloReply { message: line };
            }
        };

        Ok(Response::new(Box::pin(output)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let admin_username = std::env::var("GRPC_ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string());
    let admin_password =
        std::env::var("GRPC_ADMIN_PASSWORD").unwrap_or_else(|_| "admin123456".to_string());
    let addr = std::env::var("GRPC_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:50051".to_string())
        .parse()?;
    let service = DemoServiceServer::new(DemoGrpcService::new(
        admin_username.clone(),
        admin_password.clone(),
    ));

    println!("gRPC server listening on http://{addr}");
    println!(
        "initialized superuser: username={admin_username}, password={admin_password}"
    );

    Server::builder()
        .accept_http1(true)
        .layer(CorsLayer::very_permissive())
        .add_service(tonic_web::enable(service))
        .serve(addr)
        .await?;

    Ok(())
}
