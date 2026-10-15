import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { API } from '../config/env';

export interface Employee {
  empNumber: number;
  firstName: string;
  middleName: string;
  lastName: string;
  employeeId: string | null;
  terminationId: number | null;
}

/** PIM employee search that backs every "Employee Name" autocomplete (exploration §3.5). */
export class EmployeesApi {
  constructor(readonly request: APIRequestContext) {}

  search(nameOrId: string, includeEmployees = 'onlyCurrent'): Promise<APIResponse> {
    return this.request.get(API.employees, { params: { nameOrId, includeEmployees } });
  }

  /**
   * Resolves a current employee to link fixture users to. Prefers the documented
   * "Peter Mac Anderson"; falls back to any current employee because the shared
   * demo data is volatile (D-10).
   */
  async resolveFixtureEmployee(): Promise<Employee> {
    const preferred = await this.search('Peter');
    expect(preferred.status(), 'employee search must succeed').toBe(200);
    const peter = ((await preferred.json()).data as Employee[]).find(
      (e) => e.firstName === 'Peter' && e.lastName === 'Anderson',
    );
    if (peter) return peter;

    const any = await this.request.get(`${API.employees}`, { params: { limit: 50, includeEmployees: 'onlyCurrent' } });
    const pool = ((await any.json()).data as Employee[]).filter((e) => e.firstName && e.lastName);
    expect(pool.length, 'at least one current employee is required for fixtures').toBeGreaterThan(0);
    return pool[0];
  }
}
