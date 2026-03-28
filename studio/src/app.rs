use std::time::Duration;

use eframe::egui::{
    self, Align2, Color32, CornerRadius, FontId, Pos2, Rect, Sense, Stroke, StrokeKind, Vec2,
};

#[derive(Clone, Copy)]
struct ScenarioPreset {
    name: &'static str,
    objective: &'static str,
    mesh_cells_millions: f32,
    solve_minutes: u32,
    confidence: f32,
}

const PRESETS: [ScenarioPreset; 4] = [
    ScenarioPreset {
        name: "机载阵列罩优化",
        objective: "压低副瓣并维持 8.4 GHz 增益包线",
        mesh_cells_millions: 12.4,
        solve_minutes: 28,
        confidence: 0.92,
    },
    ScenarioPreset {
        name: "车载雷达天线扫描",
        objective: "比较 77 GHz 扫描角与热约束耦合影响",
        mesh_cells_millions: 9.8,
        solve_minutes: 19,
        confidence: 0.88,
    },
    ScenarioPreset {
        name: "舱体缝隙泄漏评估",
        objective: "识别高风险边界段并生成整改顺序",
        mesh_cells_millions: 15.1,
        solve_minutes: 36,
        confidence: 0.94,
    },
    ScenarioPreset {
        name: "星载载荷热漂移补偿",
        objective: "追踪热漂移下的中心频点回正能力",
        mesh_cells_millions: 11.6,
        solve_minutes: 24,
        confidence: 0.90,
    },
];

#[derive(Clone)]
pub struct ProjectContext {
    pub id: String,
    pub name: String,
    pub description: String,
    pub owner_user_id: String,
    pub member_count: u32,
}

impl Default for ProjectContext {
    fn default() -> Self {
        Self {
            id: "workspace-preview".to_owned(),
            name: "未命名仿真项目".to_owned(),
            description: "从项目页进入后，这里会显示当前项目的边界、目标与约束。".to_owned(),
            owner_user_id: "system".to_owned(),
            member_count: 1,
        }
    }
}

pub struct StudioWorkbenchApp {
    selected_index: usize,
    frequency_ghz: f32,
    sweep_span_mhz: f32,
    mesh_density: f32,
    solver_progress: f32,
    notes: String,
    running: bool,
    project: ProjectContext,
}

impl StudioWorkbenchApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        Self::new_with_project(cc, ProjectContext::default())
    }

    pub fn new_with_project(cc: &eframe::CreationContext<'_>, project: ProjectContext) -> Self {
        let mut visuals = egui::Visuals::light();
        visuals.panel_fill = Color32::from_rgb(244, 240, 232);
        visuals.window_fill = Color32::from_rgb(250, 248, 244);
        visuals.widgets.noninteractive.bg_fill = Color32::from_rgb(250, 248, 244);
        visuals.widgets.inactive.bg_fill = Color32::from_rgb(241, 237, 229);
        visuals.widgets.hovered.bg_fill = Color32::from_rgb(228, 239, 246);
        visuals.widgets.active.bg_fill = Color32::from_rgb(208, 229, 238);
        visuals.selection.bg_fill = Color32::from_rgb(28, 113, 134);
        visuals.hyperlink_color = Color32::from_rgb(17, 79, 122);
        cc.egui_ctx.set_visuals(visuals);

        Self {
            selected_index: 0,
            frequency_ghz: 8.4,
            sweep_span_mhz: 320.0,
            mesh_density: 0.64,
            solver_progress: 0.18,
            notes: format!(
                "项目说明：{}\n负责人：{}\n参与成员：{} 人",
                project.description, project.owner_user_id, project.member_count
            ),
            running: false,
            project,
        }
    }

    fn selected_preset(&self) -> ScenarioPreset {
        PRESETS[self.selected_index]
    }

    fn paint_signal_plot(&self, ui: &mut egui::Ui, rect: Rect) {
        let painter = ui.painter_at(rect);
        let background = Color32::from_rgb(247, 245, 240);
        let frame = Color32::from_rgb(208, 221, 229);
        let accent = Color32::from_rgb(16, 108, 130);
        let secondary = Color32::from_rgb(196, 127, 44);

        painter.rect(
            rect,
            CornerRadius::same(22),
            background,
            Stroke::new(1.0, frame),
            StrokeKind::Outside,
        );

        let inner = rect.shrink2(Vec2::new(20.0, 22.0));
        let grid_color = Color32::from_rgba_premultiplied(102, 124, 144, 38);

        for step in 0..=4 {
            let t = step as f32 / 4.0;
            let y = egui::lerp(inner.bottom()..=inner.top(), t);
            painter.line_segment(
                [Pos2::new(inner.left(), y), Pos2::new(inner.right(), y)],
                Stroke::new(1.0, grid_color),
            );
        }

        for step in 0..=6 {
            let t = step as f32 / 6.0;
            let x = egui::lerp(inner.left()..=inner.right(), t);
            painter.line_segment(
                [Pos2::new(x, inner.top()), Pos2::new(x, inner.bottom())],
                Stroke::new(1.0, grid_color),
            );
        }

        let mut primary_points = Vec::with_capacity(121);
        let mut envelope_points = Vec::with_capacity(121);

        for idx in 0..=120 {
            let t = idx as f32 / 120.0;
            let x = egui::lerp(inner.left()..=inner.right(), t);
            let phase = t * std::f32::consts::TAU * 1.7;
            let primary = -17.0
                + phase.sin() * (5.0 + self.mesh_density * 2.5)
                + ((t * 6.0) - 2.4).powi(2) * -0.85;
            let envelope = primary + 2.8 + (phase * 0.6).cos() * 1.6;
            let y_primary = egui::remap_clamp(primary, -28.0..=2.0, inner.bottom()..=inner.top());
            let y_envelope = egui::remap_clamp(envelope, -28.0..=2.0, inner.bottom()..=inner.top());
            primary_points.push(Pos2::new(x, y_primary));
            envelope_points.push(Pos2::new(x, y_envelope));
        }

        painter.add(egui::Shape::line(primary_points, Stroke::new(2.6, accent)));
        painter.add(egui::Shape::line(envelope_points, Stroke::new(1.6, secondary)));

        painter.text(
            Pos2::new(inner.left(), inner.top() - 6.0),
            Align2::LEFT_BOTTOM,
            "频域响应预览",
            FontId::proportional(18.0),
            Color32::from_rgb(34, 57, 81),
        );
        painter.text(
            Pos2::new(inner.left(), inner.bottom() + 8.0),
            Align2::LEFT_TOP,
            format!(
                "中心频点 {:.2} GHz  |  扫频跨度 {:.0} MHz  |  网格密度 {:.0}%",
                self.frequency_ghz,
                self.sweep_span_mhz,
                self.mesh_density * 100.0
            ),
            FontId::proportional(14.0),
            Color32::from_rgb(91, 107, 126),
        );
    }
}

impl eframe::App for StudioWorkbenchApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if self.running {
            self.solver_progress = (self.solver_progress + 0.0045).min(1.0);
            if self.solver_progress >= 1.0 {
                self.running = false;
            } else {
                ctx.request_repaint_after(Duration::from_millis(16));
            }
        }

        let preset = self.selected_preset();

        egui::TopBottomPanel::top("studio_topbar")
            .exact_height(72.0)
            .show(ctx, |ui| {
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new("Simulation Studio")
                                .size(24.0)
                                .strong()
                                .color(Color32::from_rgb(28, 46, 72)),
                        );
                        ui.label(
                            egui::RichText::new(format!(
                                "{}  |  负责人 {}",
                                self.project.name, self.project.owner_user_id
                            ))
                                .size(14.0)
                                .color(Color32::from_rgb(88, 104, 124)),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let action_label = if self.running { "求解中..." } else { "启动求解" };
                        if ui
                            .add_enabled(!self.running, egui::Button::new(action_label).min_size(Vec2::new(112.0, 40.0)))
                            .clicked()
                        {
                            self.running = true;
                            self.solver_progress = 0.04;
                        }

                        if ui.button("重置参数").clicked() {
                            self.frequency_ghz = 8.4;
                            self.sweep_span_mhz = 320.0;
                            self.mesh_density = 0.64;
                            self.solver_progress = 0.18;
                            self.running = false;
                        }
                    });
                });
            });

        egui::SidePanel::left("studio_sidebar")
            .resizable(false)
            .min_width(320.0)
            .default_width(344.0)
            .show(ctx, |ui| {
                ui.add_space(8.0);
                ui.heading("方案库");
                ui.label(
                    egui::RichText::new("选择一个场景作为当前建模基线。")
                        .size(13.0)
                        .color(Color32::from_rgb(88, 104, 124)),
                );
                ui.add_space(10.0);

                for (index, item) in PRESETS.iter().enumerate() {
                    let selected = self.selected_index == index;
                    let response = ui.selectable_label(selected, item.name);
                    if response.clicked() {
                        self.selected_index = index;
                    }
                    ui.label(
                        egui::RichText::new(item.objective)
                            .size(12.5)
                            .color(Color32::from_rgb(112, 125, 141)),
                    );
                    ui.add_space(6.0);
                }

                ui.separator();
                ui.heading("求解参数");
                ui.add(egui::Slider::new(&mut self.frequency_ghz, 2.0..=40.0).text("中心频点 (GHz)"));
                ui.add(egui::Slider::new(&mut self.sweep_span_mhz, 50.0..=1600.0).text("扫频跨度 (MHz)"));
                ui.add(egui::Slider::new(&mut self.mesh_density, 0.2..=1.0).text("网格密度"));
                ui.add_space(8.0);
                ui.label("工程笔记");
                ui.add(
                    egui::TextEdit::multiline(&mut self.notes)
                        .desired_rows(7)
                        .hint_text("记录假设、版本号和待验证参数"),
                );
            });

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.add_space(8.0);
            ui.columns(2, |columns| {
                columns[0].group(|ui| {
                    ui.set_min_height(158.0);
                    ui.label(
                        egui::RichText::new(self.project.name.as_str())
                            .size(22.0)
                            .strong()
                            .color(Color32::from_rgb(31, 49, 77)),
                    );
                    ui.add_space(6.0);
                    ui.label(self.project.description.as_str());
                    ui.add_space(14.0);
                    ui.horizontal_wrapped(|ui| {
                        ui.label(format!("项目编号 {}", self.project.id));
                        ui.separator();
                        ui.label(format!("成员 {} 人", self.project.member_count));
                        ui.separator();
                        ui.label(format!("网格规模 {:.1} M cells", preset.mesh_cells_millions));
                        ui.separator();
                        ui.label(format!("预计耗时 {} 分钟", preset.solve_minutes));
                        ui.separator();
                        ui.label(format!("置信度 {:.0}%", preset.confidence * 100.0));
                    });
                    ui.add_space(14.0);
                    ui.add(
                        egui::ProgressBar::new(self.solver_progress)
                            .desired_width(f32::INFINITY)
                            .text(if self.running { "求解推进中" } else { "当前求解进度" }),
                    );
                });

                columns[1].group(|ui| {
                    ui.set_min_height(158.0);
                    ui.heading("分析摘要");
                    ui.add_space(8.0);
                    ui.label(format!("1. 当前场景基线：{}。", preset.name));
                    ui.label(format!("2. 项目负责人 {} 正在评估参数窗口。", self.project.owner_user_id));
                    ui.label("3. 右下工作区预留结果视图，可继续接入 S 参数或场分布。");
                    let badge = if self.running { "Solver Active" } else { "Workbench Ready" };
                    ui.label(
                        egui::RichText::new(badge)
                            .color(Color32::from_rgb(11, 108, 90))
                            .strong(),
                    );
                });
            });

            ui.add_space(12.0);
            let available = ui.available_size();
            let plot_height = (available.y - 160.0).max(280.0);
            let desired = Vec2::new(available.x, plot_height);
            let (rect, _) = ui.allocate_exact_size(desired, Sense::hover());
            self.paint_signal_plot(ui, rect);
        });
    }
}