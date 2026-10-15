import path from 'path';

export const ENV = {
  baseURL: process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com',
  adminUsername: process.env.ADMIN_USERNAME ?? 'Admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123',
  productVersion: process.env.PRODUCT_VERSION ?? 'OrangeHRM OS 5.9',
} as const;

/** Storage state of the shared Admin session produced by tests/setup/auth.setup.ts. */
export const ADMIN_STATE = path.join(__dirname, '..', '..', '.auth', 'admin.json');

const WEB = '/web/index.php';

export const ROUTES = {
  login: `${WEB}/auth/login`,
  validate: `${WEB}/auth/validate`,
  logout: `${WEB}/auth/logout`,
  requestPasswordResetCode: `${WEB}/auth/requestPasswordResetCode`,
  requestResetPassword: `${WEB}/auth/requestResetPassword`,
  sendPasswordReset: `${WEB}/auth/sendPasswordReset`,
  dashboard: `${WEB}/dashboard/index`,
  systemUsers: `${WEB}/admin/viewSystemUsers`,
  saveSystemUser: `${WEB}/admin/saveSystemUser`,
  registerOAuthClient: `${WEB}/admin/registerOAuthClient`,
} as const;

export const API_BASE = `${WEB}/api/v2`;

export const API = {
  users: `${API_BASE}/admin/users`,
  user: (id: number | string) => `${API_BASE}/admin/users/${id}`,
  usernameValidation: `${API_BASE}/admin/validation/user-name`,
  employees: `${API_BASE}/pim/employees`,
} as const;

/** Stable role ids (exploration §3.1). */
export const ROLE = { Admin: 1, ESS: 2 } as const;
