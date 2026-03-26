import * as protobuf from "protobufjs/minimal";

export interface HelloRequest {
  name: string;
  message: string;
}

export interface HelloReply {
  message: string;
}

export function encodeHelloRequest(input: HelloRequest): Uint8Array {
  const writer = protobuf.Writer.create();
  if (input.name.length > 0) {
    writer.uint32(10).string(input.name);
  }
  if (input.message.length > 0) {
    writer.uint32(18).string(input.message);
  }
  return writer.finish();
}

export function decodeHelloReply(bytes: Uint8Array): HelloReply {
  const reader = protobuf.Reader.create(bytes);
  let message = "";

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        message = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return { message };
}
