use std::pin::Pin;

use backend_core::{
    bidi_stream as core_bidi_stream, client_stream as core_client_stream,
    surrealdb_read_test as core_surrealdb_read_test,
    server_stream as core_server_stream, surrealdb_roundtrip_test as core_surrealdb_roundtrip_test,
    unary as core_unary, DemoInput,
};
use futures_core::Stream;
use proto::demo::{
    demo_service_server::{DemoService, DemoServiceServer},
    HelloReply, HelloRequest,
};
use tokio_stream::StreamExt;
use tonic::{transport::Server, Request, Response, Status};
use tower_http::cors::CorsLayer;

struct DemoGrpcService {
    expected_token: String,
}

impl DemoGrpcService {
    fn authorize<T>(&self, request: &Request<T>) -> Result<(), Status> {
        let auth = request
            .metadata()
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| Status::unauthenticated("missing authorization header"))?;

        let expected = format!("Bearer {}", self.expected_token);
        if auth != expected {
            return Err(Status::unauthenticated("invalid bearer token"));
        }

        Ok(())
    }
}

type ReplyStream = Pin<Box<dyn Stream<Item = Result<HelloReply, Status>> + Send + 'static>>;

#[tonic::async_trait]
impl DemoService for DemoGrpcService {
    async fn say_hello(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<HelloReply>, Status> {
        self.authorize(&request)?;
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
        self.authorize(&request)?;
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
        self.authorize(&request)?;
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
        self.authorize(&request)?;
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
    let expected_token = std::env::var("GRPC_AUTH_TOKEN").unwrap_or_else(|_| "dev-token".to_string());
    let addr = std::env::var("GRPC_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:50051".to_string())
        .parse()?;
    let service = DemoServiceServer::new(DemoGrpcService { expected_token });

    println!("gRPC server listening on http://{addr}");

    Server::builder()
        .accept_http1(true)
        .layer(CorsLayer::very_permissive())
        .add_service(tonic_web::enable(service))
        .serve(addr)
        .await?;

    Ok(())
}
