import { expect } from '@playwright/test';
import type { AdminUsersApi, SystemUser } from '../api/AdminUsersApi';
import type { Employee } from '../api/EmployeesApi';
import { ROLE } from '../config/env';
import { uniqueUsername, VALID_PASSWORD } from '../data/testData';

export interface FixtureUser {
  id: number;
  username: string;
  password: string;
  roleId: number;
  status: boolean;
  empNumber: number;
  employee: Employee;
}

export interface CreateOptions {
  role?: keyof typeof ROLE;
  enabled?: boolean;
  prefix?: string;
  password?: string;
}

/**
 * Creates disposable system users through the API and deletes every one of them
 * at teardown — tests never depend on, or mutate, records they did not create
 * (exploration D-10). Users created through the UI are registered with track*().
 */
export class UserFactory {
  private readonly ids = new Set<number>();

  constructor(private readonly api: AdminUsersApi, private readonly employee: Employee) {}

  async create(options: CreateOptions = {}): Promise<FixtureUser> {
    const username = uniqueUsername(options.prefix ?? 'qafx');
    const password = options.password ?? VALID_PASSWORD;
    const roleId = ROLE[options.role ?? 'ESS'];
    const status = options.enabled ?? true;

    const res = await this.api.create({ username, password, status, userRoleId: roleId, empNumber: this.employee.empNumber });
    expect(res.status(), `fixture user creation failed: ${await res.text()}`).toBe(200);
    const user = (await res.json()).data as SystemUser;
    this.ids.add(user.id);
    return { id: user.id, username, password, roleId, status, empNumber: this.employee.empNumber, employee: this.employee };
  }

  async createMany(count: number, options: CreateOptions = {}): Promise<FixtureUser[]> {
    const users: FixtureUser[] = [];
    for (let i = 0; i < count; i++) users.push(await this.create(options));
    return users;
  }

  track(id: number): void {
    this.ids.add(id);
  }

  untrack(id: number): void {
    this.ids.delete(id);
  }

  /** Registers a user created outside the factory (e.g. through the UI) for cleanup. */
  async trackUsername(username: string): Promise<SystemUser | undefined> {
    const user = await this.api.findByUsername(username);
    if (user) this.ids.add(user.id);
    return user;
  }

  async cleanup(): Promise<void> {
    if (this.ids.size === 0) return;
    const ids = [...this.ids];
    const res = await this.api.delete(ids);
    if (!res.ok()) {
      // Bulk delete fails if one id is already gone — fall back to one-by-one.
      for (const id of ids) await this.api.delete([id]).catch(() => undefined);
    }
    this.ids.clear();
  }
}
