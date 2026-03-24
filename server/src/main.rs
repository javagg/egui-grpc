use std::pin::Pin;

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
            message: format!("Unary: hello {}, message={}", req.name, req.message),
        }))
    }

    type ServerStreamStream = ReplyStream;

    async fn server_stream(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<Self::ServerStreamStream>, Status> {
        let req = request.into_inner();
        let name = req.name;

        let stream = async_stream::try_stream! {
            for idx in 1..=5 {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                yield HelloReply {
                    message: format!("Server stream #{idx} -> {name}"),
                };
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
            names.push(msg.name);
        }

        Ok(Response::new(HelloReply {
            message: format!("Client stream: received {} messages from {:?}", count, names),
        }))
    }

    type BidiStreamStream = ReplyStream;

    async fn bidi_stream(
        &self,
        request: Request<tonic::Streaming<HelloRequest>>,
    ) -> Result<Response<Self::BidiStreamStream>, Status> {
        let mut input = request.into_inner();

        let output = async_stream::try_stream! {
            while let Some(item) = input.next().await {
                let req = item?;
                yield HelloReply {
                    message: format!("Bidi echo => {} says {}", req.name, req.message),
                };
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
