import * as protobuf from "protobufjs/minimal";

export interface HelloRequest {
  name: string;
  message: string;
}

export interface HelloReply {
  message: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface RegisterReply {
  ok: boolean;
  username: string;
  token: string;
  isSuperuser: boolean;
}

export interface LoginReply {
  token: string;
  username: string;
  isSuperuser: boolean;
}

export interface LogoutRequest {}

export interface LogoutReply {
  ok: boolean;
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

export function encodeLoginRequest(input: LoginRequest): Uint8Array {
  const writer = protobuf.Writer.create();
  if (input.username.length > 0) {
    writer.uint32(10).string(input.username);
  }
  if (input.password.length > 0) {
    writer.uint32(18).string(input.password);
  }
  return writer.finish();
}

export function encodeRegisterRequest(input: RegisterRequest): Uint8Array {
  const writer = protobuf.Writer.create();
  if (input.username.length > 0) {
    writer.uint32(10).string(input.username);
  }
  if (input.password.length > 0) {
    writer.uint32(18).string(input.password);
  }
  return writer.finish();
}

export function decodeRegisterReply(bytes: Uint8Array): RegisterReply {
  const reader = protobuf.Reader.create(bytes);
  let ok = false;
  let username = "";
  let token = "";
  let isSuperuser = false;

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        ok = reader.bool();
        break;
      case 2:
        username = reader.string();
        break;
      case 3:
        token = reader.string();
        break;
      case 4:
        isSuperuser = reader.bool();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return { ok, username, token, isSuperuser };
}

export function decodeLoginReply(bytes: Uint8Array): LoginReply {
  const reader = protobuf.Reader.create(bytes);
  let token = "";
  let username = "";
  let isSuperuser = false;

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        token = reader.string();
        break;
      case 2:
        username = reader.string();
        break;
      case 3:
        isSuperuser = reader.bool();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return { token, username, isSuperuser };
}

export function encodeLogoutRequest(_: LogoutRequest): Uint8Array {
  return protobuf.Writer.create().finish();
}

export function decodeLogoutReply(bytes: Uint8Array): LogoutReply {
  const reader = protobuf.Reader.create(bytes);
  let ok = false;

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        ok = reader.bool();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return { ok };
}
