use std::collections::HashMap;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;

#[cfg(not(target_arch = "wasm32"))]
use std::sync::{LazyLock, RwLock};

#[derive(Clone, Debug)]
pub struct DemoInput {
    pub name: String,
    pub message: String,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub owner_user_id: String,
    pub member_user_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CreateProjectInput {
    pub id: String,
    pub name: String,
    pub description: String,
    pub owner_user_id: String,
    pub member_user_ids: Vec<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct UpdateProjectInput {
    pub id: String,
    pub name: String,
    pub description: String,
    pub owner_user_id: String,
    pub member_user_ids: Vec<String>,
}

#[cfg(not(target_arch = "wasm32"))]
static PROJECTS: LazyLock<RwLock<HashMap<String, ProjectRecord>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

#[cfg(target_arch = "wasm32")]
thread_local! {
    static PROJECTS: RefCell<HashMap<String, ProjectRecord>> = RefCell::new(HashMap::new());
}

fn with_projects_read<T>(f: impl FnOnce(&HashMap<String, ProjectRecord>) -> T) -> T {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let guard = PROJECTS.read().expect("project storage poisoned");
        f(&guard)
    }

    #[cfg(target_arch = "wasm32")]
    {
        PROJECTS.with(|storage| {
            let guard = storage.borrow();
            f(&guard)
        })
    }
}

fn with_projects_write<T>(f: impl FnOnce(&mut HashMap<String, ProjectRecord>) -> T) -> T {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let mut guard = PROJECTS.write().expect("project storage poisoned");
        f(&mut guard)
    }

    #[cfg(target_arch = "wasm32")]
    {
        PROJECTS.with(|storage| {
            let mut guard = storage.borrow_mut();
            f(&mut guard)
        })
    }
}

fn now_unix_ms_string() -> String {
    #[cfg(target_arch = "wasm32")]
    {
        return (js_sys::Date::now() as u64).to_string();
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_else(|_| std::time::Duration::from_millis(0))
        .as_millis();
    now.to_string()
    }
}

fn normalize_user_id(raw: &str) -> String {
    raw.trim().to_string()
}

fn normalize_members(owner_user_id: &str, members: &[String]) -> Vec<String> {
    let owner = normalize_user_id(owner_user_id);
    let mut normalized = members
        .iter()
        .map(|item| normalize_user_id(item))
        .filter(|item| !item.is_empty())
        .collect::<Vec<String>>();

    if !normalized.iter().any(|item| item == &owner) {
        normalized.push(owner);
    }

    normalized.sort();
    normalized.dedup();
    normalized
}

pub fn list_projects_for_user(user_id: &str) -> Vec<ProjectRecord> {
    let target = normalize_user_id(user_id);
    if target.is_empty() {
        return Vec::new();
    }

    let mut list = with_projects_read(|projects| {
        projects
            .values()
            .filter(|item| {
                item.owner_user_id == target
                    || item.member_user_ids.iter().any(|member| member == &target)
            })
            .cloned()
            .collect::<Vec<ProjectRecord>>()
    });

    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list
}

pub fn create_project(input: CreateProjectInput) -> Result<ProjectRecord, String> {
    let owner_user_id = normalize_user_id(&input.owner_user_id);
    let name = input.name.trim().to_string();

    if input.id.trim().is_empty() {
        return Err("project id must not be empty".to_string());
    }

    if owner_user_id.is_empty() {
        return Err("owner user id must not be empty".to_string());
    }

    if name.is_empty() {
        return Err("project name must not be empty".to_string());
    }

    let created_at = now_unix_ms_string();
    let project = ProjectRecord {
        id: input.id,
        name,
        description: input.description.trim().to_string(),
        owner_user_id: owner_user_id.clone(),
        member_user_ids: normalize_members(&owner_user_id, &input.member_user_ids),
        created_at: created_at.clone(),
        updated_at: created_at,
    };

    let created = with_projects_write(|projects| {
        if projects.contains_key(&project.id) {
            return Err("project id already exists".to_string());
        }

        projects.insert(project.id.clone(), project.clone());
        Ok(project.clone())
    })?;

    Ok(created)
}

pub fn update_project(
    requester_user_id: &str,
    requester_is_superuser: bool,
    input: UpdateProjectInput,
) -> Result<ProjectRecord, String> {
    let requester = normalize_user_id(requester_user_id);
    if requester.is_empty() {
        return Err("request user id must not be empty".to_string());
    }

    if input.id.trim().is_empty() {
        return Err("project id must not be empty".to_string());
    }

    let owner_user_id = normalize_user_id(&input.owner_user_id);
    let name = input.name.trim().to_string();
    if owner_user_id.is_empty() {
        return Err("owner user id must not be empty".to_string());
    }

    if name.is_empty() {
        return Err("project name must not be empty".to_string());
    }

    with_projects_write(|projects| {
        let project = projects
            .get_mut(&input.id)
            .ok_or_else(|| "project not found".to_string())?;

        if !requester_is_superuser && project.owner_user_id != requester {
            return Err("permission denied".to_string());
        }

        project.name = name;
        project.description = input.description.trim().to_string();
        project.owner_user_id = owner_user_id.clone();
        project.member_user_ids = normalize_members(&owner_user_id, &input.member_user_ids);
        project.updated_at = now_unix_ms_string();
        Ok(project.clone())
    })
}

pub fn delete_project(
    requester_user_id: &str,
    requester_is_superuser: bool,
    project_id: &str,
) -> Result<(), String> {
    let requester = normalize_user_id(requester_user_id);
    if requester.is_empty() {
        return Err("request user id must not be empty".to_string());
    }

    if project_id.trim().is_empty() {
        return Err("project id must not be empty".to_string());
    }

    with_projects_write(|projects| {
        let existing = projects
            .get(project_id)
            .ok_or_else(|| "project not found".to_string())?
            .clone();

        if !requester_is_superuser && existing.owner_user_id != requester {
            return Err("permission denied".to_string());
        }

        projects.remove(project_id);
        Ok(())
    })
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
