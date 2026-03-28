mod app;

pub use app::{ProjectContext, StudioWorkbenchApp};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{prelude::*, JsCast};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn start_with_canvas_id(canvas_id: &str) -> Result<(), JsValue> {
    start_with_canvas_and_project(canvas_id, "workspace-preview", "未命名仿真项目", "", "system", 1).await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn start_with_canvas_and_project(
    canvas_id: &str,
    project_id: &str,
    project_name: &str,
    project_description: &str,
    owner_user_id: &str,
    member_count: u32,
) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();

    let window = web_sys::window().ok_or_else(|| JsValue::from_str("window not available"))?;
    let document = window
        .document()
        .ok_or_else(|| JsValue::from_str("document not available"))?;
    let canvas = document
        .get_element_by_id(canvas_id)
        .ok_or_else(|| JsValue::from_str("canvas element not found"))?
        .dyn_into::<web_sys::HtmlCanvasElement>()
        .map_err(|_| JsValue::from_str("element is not a canvas"))?;
    let project = ProjectContext {
        id: project_id.to_owned(),
        name: project_name.to_owned(),
        description: project_description.to_owned(),
        owner_user_id: owner_user_id.to_owned(),
        member_count,
    };

    eframe::WebRunner::new()
        .start(
            canvas,
            eframe::WebOptions::default(),
            Box::new(move |cc| {
                Ok(Box::new(StudioWorkbenchApp::new_with_project(
                    cc,
                    project.clone(),
                )))
            }),
        )
        .await
}