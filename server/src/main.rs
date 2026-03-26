use std::pin::Pin;

use backend_core::{
    bidi_stream as core_bidi_stream, client_stream as core_client_stream,
    server_stream as core_server_stream, unary as core_unary, DemoInput,
};
use futures_core::Stream;
use proto::demo::{
    demo_service_server::{DemoService, DemoServiceServer},
    HelloReply, HelloRequest,
};
use tokio_stream::StreamExt;
use tonic::{transport::Server, Request, Response, Status};
use tower_http::cors::CorsLayer;

#[derive(Default)]
struct DemoGrpcService;

type ReplyStream = Pin<Box<dyn Stream<Item = Result<HelloReply, Status>> + Send + 'static>>;

#[tonic::async_trait]
impl DemoService for DemoGrpcService {
    async fn say_hello(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<HelloReply>, Status> {
        let req = request.into_inner();
        Ok(Response::new(HelloReply {
            message: core_unary(DemoInput {
                name: req.name,
                message: req.message,
            }),
        }))
    }

    type ServerStreamStream = ReplyStream;

    async fn server_stream(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<Self::ServerStreamStream>, Status> {
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
    let addr = "0.0.0.0:50051".parse()?;
    let service = DemoServiceServer::new(DemoGrpcService);

    println!("gRPC server listening on http://{addr}");

    Server::builder()
        .accept_http1(true)
        .layer(CorsLayer::very_permissive())
        .add_service(tonic_web::enable(service))
        .serve(addr)
        .await?;

    Ok(())
}
