use backend_core::{
    bidi_stream, client_stream, server_stream, surrealdb_read_test, surrealdb_roundtrip_test,
    unary, DemoInput,
};
use js_sys::Array;
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
