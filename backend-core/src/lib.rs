#[derive(Clone, Debug)]
pub struct DemoInput {
    pub name: String,
    pub message: String,
}

pub fn unary(input: DemoInput) -> String {
    format!("Unary: hello {}, message={}", input.name, input.message)
}

pub fn server_stream(input: DemoInput) -> Vec<String> {
    (1..=5)
        .map(|idx| format!("Server stream #{idx} -> {}", input.name))
        .collect()
}

pub fn client_stream(inputs: Vec<DemoInput>) -> String {
    let count = inputs.len();
    let names: Vec<String> = inputs.into_iter().map(|x| x.name).collect();
    format!("Client stream: received {} messages from {:?}", count, names)
}

pub fn bidi_stream(inputs: Vec<DemoInput>) -> Vec<String> {
    inputs
        .into_iter()
        .map(|x| format!("Bidi echo => {} says {}", x.name, x.message))
        .collect()
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
struct DemoDbRecord {
    name: String,
    message: String,
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn surrealdb_roundtrip_test(input: DemoInput) -> Result<String, String> {
    use surrealdb::{engine::local::Mem, Surreal};

    let db = Surreal::new::<Mem>(())
        .await
        .map_err(|e| format!("create db failed: {e}"))?;

    db.use_ns("demo_ns")
        .use_db("demo_db")
        .await
        .map_err(|e| format!("select ns/db failed: {e}"))?;

    let key = format!("{}-{}", input.name, input.message);
    let payload = DemoDbRecord {
        name: input.name,
        message: input.message,
    };

    let _: Option<DemoDbRecord> = db
        .create(("demo_items", key.as_str()))
        .content(payload.clone())
        .await
        .map_err(|e| format!("create record failed: {e}"))?;

    let read_back: Option<DemoDbRecord> = db
        .select(("demo_items", key.as_str()))
        .await
        .map_err(|e| format!("select record failed: {e}"))?;

    let record = read_back.ok_or_else(|| "no record returned from surrealdb".to_string())?;

    Ok(format!(
        "DB_TEST_OK key={key} value={}::{}",
        record.name, record.message
    ))
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn surrealdb_read_test(input: DemoInput) -> Result<String, String> {
    use surrealdb::{engine::local::Mem, Surreal};

    let db = Surreal::new::<Mem>(())
        .await
        .map_err(|e| format!("create db failed: {e}"))?;

    db.use_ns("demo_ns")
        .use_db("demo_db")
        .await
        .map_err(|e| format!("select ns/db failed: {e}"))?;

    let key = format!("{}-{}", input.name, input.message);
    let read_back: Option<DemoDbRecord> = db
        .select(("demo_items", key.as_str()))
        .await
        .map_err(|e| format!("select record failed: {e}"))?;

    let record = read_back.ok_or_else(|| format!("DB_READ_MISS key={key}"))?;

    Ok(format!(
        "DB_READ_OK key={key} value={}::{}",
        record.name, record.message
    ))
}

#[cfg(target_arch = "wasm32")]
pub async fn surrealdb_roundtrip_test(input: DemoInput) -> Result<String, String> {
    use surrealdb::{engine::local::IndxDb, Surreal};

    let db = Surreal::new::<IndxDb>("egui_grpc_local_db")
        .await
        .map_err(|e| format!("create db failed: {e}"))?;

    db.use_ns("demo_ns")
        .use_db("demo_db")
        .await
        .map_err(|e| format!("select ns/db failed: {e}"))?;

    let key = format!("{}-{}", input.name, input.message);
    let payload = DemoDbRecord {
        name: input.name,
        message: input.message,
    };

    let _: Option<DemoDbRecord> = db
        .create(("demo_items", key.as_str()))
        .content(payload.clone())
        .await
        .map_err(|e| format!("create record failed: {e}"))?;

    let read_back: Option<DemoDbRecord> = db
        .select(("demo_items", key.as_str()))
        .await
        .map_err(|e| format!("select record failed: {e}"))?;

    let record = read_back.ok_or_else(|| "no record returned from surrealdb".to_string())?;

    Ok(format!(
        "DB_TEST_OK key={key} value={}::{}",
        record.name, record.message
    ))
}

#[cfg(target_arch = "wasm32")]
pub async fn surrealdb_read_test(input: DemoInput) -> Result<String, String> {
    use surrealdb::{engine::local::IndxDb, Surreal};

    let db = Surreal::new::<IndxDb>("egui_grpc_local_db")
        .await
        .map_err(|e| format!("create db failed: {e}"))?;

    db.use_ns("demo_ns")
        .use_db("demo_db")
        .await
        .map_err(|e| format!("select ns/db failed: {e}"))?;

    let key = format!("{}-{}", input.name, input.message);
    let read_back: Option<DemoDbRecord> = db
        .select(("demo_items", key.as_str()))
        .await
        .map_err(|e| format!("select record failed: {e}"))?;

    let record = read_back.ok_or_else(|| format!("DB_READ_MISS key={key}"))?;

    Ok(format!(
        "DB_READ_OK key={key} value={}::{}",
        record.name, record.message
    ))
}
