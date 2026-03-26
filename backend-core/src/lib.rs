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
