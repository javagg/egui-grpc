use backend_core::{
    bidi_stream, client_stream, create_project, delete_project, list_projects_for_user,
    server_stream, surrealdb_read_test, surrealdb_roundtrip_test, unary, update_project,
    CreateProjectInput, DemoInput, UpdateProjectInput,
};
use js_sys::Array;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub async fn run_action_async(action: &str, name: &str, message: &str) -> Result<Array, JsValue> {
    let out = Array::new();

    match action {
        "Unary" => {
            if let Some(payload) = message.strip_prefix("db-test:") {
                let line = surrealdb_roundtrip_test(DemoInput {
                    name: name.to_owned(),
                    message: payload.trim().to_owned(),
                })
                .await
                .map_err(|e| JsValue::from_str(&e))?;
                out.push(&JsValue::from_str(&line));
            } else if let Some(payload) = message.strip_prefix("db-read:") {
                let line = surrealdb_read_test(DemoInput {
                    name: name.to_owned(),
                    message: payload.trim().to_owned(),
                })
                .await
                .map_err(|e| JsValue::from_str(&e))?;
                out.push(&JsValue::from_str(&line));
            } else {
                out.push(&JsValue::from_str(&unary(DemoInput {
                    name: name.to_owned(),
                    message: message.to_owned(),
                })));
            }
        }
        "ServerStream" => {
            for line in server_stream(DemoInput {
                name: name.to_owned(),
                message: message.to_owned(),
            }) {
                out.push(&JsValue::from_str(&line));
            }
        }
        "ClientStream" => {
            let inputs = vec![
                DemoInput {
                    name: name.to_owned(),
                    message: format!("{message} #1"),
                },
                DemoInput {
                    name: name.to_owned(),
                    message: format!("{message} #2"),
                },
                DemoInput {
                    name: name.to_owned(),
                    message: format!("{message} #3"),
                },
            ];
            out.push(&JsValue::from_str(&client_stream(inputs)));
        }
        "BidiStream" => {
            let inputs = vec![
                DemoInput {
                    name: name.to_owned(),
                    message: format!("{message} A"),
                },
                DemoInput {
                    name: name.to_owned(),
                    message: format!("{message} B"),
                },
                DemoInput {
                    name: name.to_owned(),
                    message: format!("{message} C"),
                },
            ];
            for line in bidi_stream(inputs) {
                out.push(&JsValue::from_str(&line));
            }
        }
        _ => return Err(JsValue::from_str("unsupported action")),
    }

    Ok(out)
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action")]
enum ProjectAction {
    #[serde(rename = "create")]
    Create {
        id: String,
        name: String,
        description: String,
        owner_user_id: String,
        member_user_ids: Vec<String>,
    },
    #[serde(rename = "list")]
    List {
        user_id: String,
    },
    #[serde(rename = "update")]
    Update {
        user_id: String,
        is_superuser: bool,
        id: String,
        name: String,
        description: String,
        owner_user_id: String,
        member_user_ids: Vec<String>,
    },
    #[serde(rename = "delete")]
    Delete {
        user_id: String,
        is_superuser: bool,
        id: String,
    },
}

#[derive(Debug, Serialize)]
struct ProjectActionReply {
    ok: bool,
    projects: Vec<backend_core::ProjectRecord>,
    project: Option<backend_core::ProjectRecord>,
}

#[wasm_bindgen]
pub async fn run_project_action_async(payload_json: &str) -> Result<JsValue, JsValue> {
    let action: ProjectAction =
        serde_json::from_str(payload_json).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let result = match action {
        ProjectAction::Create {
            id,
            name,
            description,
            owner_user_id,
            member_user_ids,
        } => {
            let project = create_project(CreateProjectInput {
                id,
                name,
                description,
                owner_user_id,
                member_user_ids,
            })
            .map_err(|e| JsValue::from_str(&e))?;

            ProjectActionReply {
                ok: true,
                projects: Vec::new(),
                project: Some(project),
            }
        }
        ProjectAction::List { user_id } => ProjectActionReply {
            ok: true,
            projects: list_projects_for_user(&user_id),
            project: None,
        },
        ProjectAction::Update {
            user_id,
            is_superuser,
            id,
            name,
            description,
            owner_user_id,
            member_user_ids,
        } => {
            let project = update_project(
                &user_id,
                is_superuser,
                UpdateProjectInput {
                    id,
                    name,
                    description,
                    owner_user_id,
                    member_user_ids,
                },
            )
            .map_err(|e| JsValue::from_str(&e))?;

            ProjectActionReply {
                ok: true,
                projects: Vec::new(),
                project: Some(project),
            }
        }
        ProjectAction::Delete {
            user_id,
            is_superuser,
            id,
        } => {
            delete_project(&user_id, is_superuser, &id).map_err(|e| JsValue::from_str(&e))?;
            ProjectActionReply {
                ok: true,
                projects: Vec::new(),
                project: None,
            }
        }
    };

    let json = serde_json::to_string(&result).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(JsValue::from_str(&json))
}
