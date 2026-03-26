import { decodeHelloReply, encodeHelloRequest, type HelloReply, type HelloRequest } from "./messages";

const SERVICE_PATH = "/demo.DemoService";

function joinUrl(endpoint: string, path: string): string {
  return `${endpoint.replace(/\/$/, "")}${path}`;
}

function frameMessage(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.length);
  out[0] = 0;
  const len = payload.length;
  out[1] = (len >>> 24) & 0xff;
  out[2] = (len >>> 16) & 0xff;
  out[3] = (len >>> 8) & 0xff;
  out[4] = len & 0xff;
  out.set(payload, 5);
  return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function parseTrailers(trailerBytes: Uint8Array): Record<string, string> {
  const text = new TextDecoder().decode(trailerBytes);
  const out: Record<string, string> = {};
  for (const line of text.split("\r\n")) {
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

async function readGrpcWebFrames(
  resp: Response,
  onMessage?: (payload: Uint8Array) => void,
): Promise<{ messages: Uint8Array[]; trailers: Record<string, string> }> {
  const messages: Uint8Array[] = [];
  let trailers: Record<string, string> = {};

  const reader = resp.body?.getReader();
  if (!reader) {
    return { messages, trailers };
  }

  let buffered = new Uint8Array(0);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const merged = new Uint8Array(buffered.length + value.length);
    merged.set(buffered);
    merged.set(value, buffered.length);
    buffered = merged;

    while (buffered.length >= 5) {
      const flag = buffered[0];
      const length =
        (buffered[1] << 24) |
        (buffered[2] << 16) |
        (buffered[3] << 8) |
        buffered[4];

      const frameTotal = 5 + length;
      if (buffered.length < frameTotal) {
        break;
      }

      const payload = buffered.slice(5, frameTotal);
      buffered = buffered.slice(frameTotal);

      if ((flag & 0x80) !== 0) {
        trailers = parseTrailers(payload);
      } else {
        messages.push(payload);
        onMessage?.(payload);
      }
    }
  }

  return { messages, trailers };
}

async function grpcWebRequest(
  endpoint: string,
  method: string,
  requestFrames: Uint8Array[],
  onMessage?: (payload: Uint8Array) => void,
): Promise<HelloReply[]> {
  const url = joinUrl(endpoint, `${SERVICE_PATH}/${method}`);
  const body = concatBytes(requestFrames);
  const bodyBuffer = body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength,
  ) as ArrayBuffer;

  const resp = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: {
      "content-type": "application/grpc-web+proto",
      "x-grpc-web": "1",
      "x-user-agent": "grpc-web-vue-demo",
    },
    body: bodyBuffer,
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const { messages, trailers } = await readGrpcWebFrames(resp, onMessage);
  const grpcStatus = trailers["grpc-status"];
  if (grpcStatus && grpcStatus !== "0") {
    const grpcMessage = trailers["grpc-message"] ?? "unknown gRPC error";
    throw new Error(`gRPC status ${grpcStatus}: ${decodeURIComponent(grpcMessage)}`);
  }

  return messages.map((m) => decodeHelloReply(m));
}

export async function sayHello(endpoint: string, req: HelloRequest): Promise<HelloReply> {
  const replies = await grpcWebRequest(endpoint, "SayHello", [frameMessage(encodeHelloRequest(req))]);
  if (replies.length === 0) {
    throw new Error("No reply from server");
  }
  return replies[0];
}

export async function serverStream(
  endpoint: string,
  req: HelloRequest,
  onReply?: (reply: HelloReply) => void,
): Promise<HelloReply[]> {
  const replies: HelloReply[] = [];
  await grpcWebRequest(endpoint, "ServerStream", [frameMessage(encodeHelloRequest(req))], (payload) => {
    const msg = decodeHelloReply(payload);
    replies.push(msg);
    onReply?.(msg);
  });
  return replies;
}

export async function clientStream(endpoint: string, reqs: HelloRequest[]): Promise<HelloReply> {
  const frames = reqs.map((req) => frameMessage(encodeHelloRequest(req)));
  const replies = await grpcWebRequest(endpoint, "ClientStream", frames);
  if (replies.length === 0) {
    throw new Error("No reply from server");
  }
  return replies[0];
}

export async function bidiStream(
  endpoint: string,
  reqs: HelloRequest[],
  onReply?: (reply: HelloReply) => void,
): Promise<HelloReply[]> {
  const frames = reqs.map((req) => frameMessage(encodeHelloRequest(req)));
  const replies: HelloReply[] = [];
  await grpcWebRequest(endpoint, "BidiStream", frames, (payload) => {
    const msg = decodeHelloReply(payload);
    replies.push(msg);
    onReply?.(msg);
  });
  return replies;
}
