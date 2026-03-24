fn main() {
    println!("cargo:rerun-if-changed=proto/demo.proto");

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .build_transport(false)
        .compile_protos(&["proto/demo.proto"], &["proto"])
        .expect("failed to compile protobuf definitions");
}
