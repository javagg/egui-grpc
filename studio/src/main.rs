#[cfg(not(target_arch = "wasm32"))]
fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1480.0, 920.0])
            .with_min_inner_size([1180.0, 760.0])
            .with_title("Simulation Studio"),
        ..Default::default()
    };

    eframe::run_native(
        "Simulation Studio",
        options,
        Box::new(|cc| Ok(Box::new(studio::StudioWorkbenchApp::new(cc)))),
    )
}

#[cfg(target_arch = "wasm32")]
fn main() {}