mod app;

pub use app::GrpcDemoApp;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{prelude::*, JsCast};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn start_with_canvas_id(canvas_id: &str) -> Result<(), JsValue> {
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

    let web_options = eframe::WebOptions::default();
    eframe::WebRunner::new()
        .start(
            canvas,
            web_options,
            Box::new(|cc| Ok(Box::new(GrpcDemoApp::new(cc)))),
        )
        .await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub async fn start() -> Result<(), JsValue> {
    start_with_canvas_id("the_canvas_id").await
}
