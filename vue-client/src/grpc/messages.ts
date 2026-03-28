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

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
  memberUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  memberUserIds: string[];
}

export interface CreateProjectReply {
  project?: Project;
}

export interface ListProjectsRequest {}

export interface ListProjectsReply {
  projects: Project[];
}

export interface UpdateProjectRequest {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
  memberUserIds: string[];
}

export interface UpdateProjectReply {
  project?: Project;
}

export interface DeleteProjectRequest {
  id: string;
}

export interface DeleteProjectReply {
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

function encodeProjectMessage(writer: protobuf.Writer, project: Project): void {
  if (project.id.length > 0) {
    writer.uint32(10).string(project.id);
  }
  if (project.name.length > 0) {
    writer.uint32(18).string(project.name);
  }
  if (project.description.length > 0) {
    writer.uint32(26).string(project.description);
  }
  if (project.ownerUserId.length > 0) {
    writer.uint32(34).string(project.ownerUserId);
  }
  for (const member of project.memberUserIds) {
    writer.uint32(42).string(member);
  }
  if (project.createdAt.length > 0) {
    writer.uint32(50).string(project.createdAt);
  }
  if (project.updatedAt.length > 0) {
    writer.uint32(58).string(project.updatedAt);
  }
}

function decodeProjectMessage(reader: protobuf.Reader, length: number): Project {
  const end = reader.pos + length;
  let id = "";
  let name = "";
  let description = "";
  let ownerUserId = "";
  const memberUserIds: string[] = [];
  let createdAt = "";
  let updatedAt = "";

  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        id = reader.string();
        break;
      case 2:
        name = reader.string();
        break;
      case 3:
        description = reader.string();
        break;
      case 4:
        ownerUserId = reader.string();
        break;
      case 5:
        memberUserIds.push(reader.string());
        break;
      case 6:
        createdAt = reader.string();
        break;
      case 7:
        updatedAt = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return {
    id,
    name,
    description,
    ownerUserId,
    memberUserIds,
    createdAt,
    updatedAt,
  };
}

export function encodeCreateProjectRequest(input: CreateProjectRequest): Uint8Array {
  const writer = protobuf.Writer.create();
  if (input.name.length > 0) {
    writer.uint32(10).string(input.name);
  }
  if (input.description.length > 0) {
    writer.uint32(18).string(input.description);
  }
  for (const member of input.memberUserIds) {
    writer.uint32(26).string(member);
  }
  return writer.finish();
}

export function decodeCreateProjectReply(bytes: Uint8Array): CreateProjectReply {
  const reader = protobuf.Reader.create(bytes);
  let project: Project | undefined;

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        project = decodeProjectMessage(reader, reader.uint32());
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return { project };
}

export function encodeListProjectsRequest(_: ListProjectsRequest): Uint8Array {
  return protobuf.Writer.create().finish();
}

export function decodeListProjectsReply(bytes: Uint8Array): ListProjectsReply {
  const reader = protobuf.Reader.create(bytes);
  const projects: Project[] = [];

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        projects.push(decodeProjectMessage(reader, reader.uint32()));
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return { projects };
}

export function encodeUpdateProjectRequest(input: UpdateProjectRequest): Uint8Array {
  const writer = protobuf.Writer.create();
  if (input.id.length > 0) {
    writer.uint32(10).string(input.id);
  }
  if (input.name.length > 0) {
    writer.uint32(18).string(input.name);
  }
  if (input.description.length > 0) {
    writer.uint32(26).string(input.description);
  }
  if (input.ownerUserId.length > 0) {
    writer.uint32(34).string(input.ownerUserId);
  }
  for (const member of input.memberUserIds) {
    writer.uint32(42).string(member);
  }
  return writer.finish();
}

export function decodeUpdateProjectReply(bytes: Uint8Array): UpdateProjectReply {
  const reader = protobuf.Reader.create(bytes);
  let project: Project | undefined;

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        project = decodeProjectMessage(reader, reader.uint32());
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return { project };
}

export function encodeDeleteProjectRequest(input: DeleteProjectRequest): Uint8Array {
  const writer = protobuf.Writer.create();
  if (input.id.length > 0) {
    writer.uint32(10).string(input.id);
  }
  return writer.finish();
}

export function decodeDeleteProjectReply(bytes: Uint8Array): DeleteProjectReply {
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
