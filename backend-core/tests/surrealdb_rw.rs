#![cfg(not(target_arch = "wasm32"))]

use backend_core::{surrealdb_roundtrip_test, DemoInput};

#[tokio::test]
async fn surrealdb_roundtrip_read_write_works() {
    let out = surrealdb_roundtrip_test(DemoInput {
        name: "tester".to_string(),
        message: "surreal-message".to_string(),
    })
    .await
    .expect("surrealdb roundtrip should succeed");

    assert!(out.contains("DB_TEST_OK"));
    assert!(out.contains("tester"));
    assert!(out.contains("surreal-message"));
}
