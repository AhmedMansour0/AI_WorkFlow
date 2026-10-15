import type { APIRequestContext, APIResponse } from '@playwright/test';
import { API } from '../config/env';

export interface UserRole {
  id: number;
  name: string;
  displayName: string;
}

export interface UserEmployee {
  empNumber: number;
  employeeId: string | null;
  firstName: string;
  middleName: string;
  lastName: string;
  terminationId: number | null;
}

export interface SystemUser {
  id: number;
  userName: string;
  deleted: boolean;
  status: boolean;
  employee: UserEmployee;
  userRole: UserRole;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  status: boolean;
  userRoleId: number;
  empNumber: number;
}

export interface UpdateUserPayload {
  username: string;
  password?: string | null;
  status: boolean;
  userRoleId: number;
  empNumber: number;
  changePassword: boolean;
}

export type ListParams = Partial<{
  limit: number;
  offset: number;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  username: string;
  userRoleId: number;
  empNumber: number;
  status: boolean | string;
}>;

/**
 * Thin client for the OrangeHRM OS REST API v2 — Admin / User Management
 * (exploration §3). Auth is the `orangehrm` session cookie carried by the
 * injected request context. Methods return raw responses so specs own every
 * status/body assertion; nothing here throws on non-2xx.
 */
export class AdminUsersApi {
  constructor(readonly request: APIRequestContext) {}

  list(params: ListParams = {}): Promise<APIResponse> {
    const query: Record<string, string | number | boolean> = { limit: 50, offset: 0 };
    for (const [k, v] of Object.entries(params)) if (v !== undefined) query[k] = v;
    return this.request.get(API.users, { params: query });
  }

  get(id: number | string): Promise<APIResponse> {
    return this.request.get(API.user(id));
  }

  create(payload: Partial<CreateUserPayload> | Record<string, unknown>): Promise<APIResponse> {
    return this.request.post(API.users, { data: payload });
  }

  update(id: number | string, payload: Partial<UpdateUserPayload> | Record<string, unknown>): Promise<APIResponse> {
    return this.request.put(API.user(id), { data: payload });
  }

  /** DELETE targets the collection URL with ids in the body — not /users/{id} (exploration §3.6). */
  delete(ids: Array<number | string>): Promise<APIResponse> {
    return this.request.delete(API.users, { data: { ids } });
  }

  validateUsername(userName: string): Promise<APIResponse> {
    return this.request.get(API.usernameValidation, { params: { userName } });
  }

  /** Exact-username lookup; returns undefined when the user does not exist. */
  async findByUsername(username: string): Promise<SystemUser | undefined> {
    const res = await this.list({ username });
    if (!res.ok()) return undefined;
    const body = (await res.json()) as { data: SystemUser[] };
    return body.data.find((u) => u.userName === username);
  }
}
