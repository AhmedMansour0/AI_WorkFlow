import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { API, ROUTES } from '../config/env';
import { Autocomplete } from '../components/Autocomplete';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { AppShell } from '../components/AppShell';

/** Desktop-layout column order inside `.oxd-table-row` (cell 1 is the bulk-select checkbox). */
const COLUMN = { username: 2, role: 3, employee: 4, status: 5 } as const;
type Column = keyof typeof COLUMN;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Admin > User Management > Users — GET /web/index.php/admin/viewSystemUsers.
 *
 * The list is a div grid with ARIA table roles, not <table>/<tr>/<td>.
 * Row Edit/Delete are icon-only buttons with NO accessible name (exploration
 * §2.1 hazard). They are anchored on their icon glyph class (bi-pencil-fill /
 * bi-trash) inside the row rather than on index, which survives a reorder of
 * the two buttons.
 */
export class SystemUsersPage {
  readonly shell: AppShell;
  readonly toast: Toast;
  readonly dialog: ConfirmDialog;

  readonly filterPanel: Locator;
  readonly filterToggle: Locator;
  readonly usernameFilter: FormField;
  readonly roleFilter: FormField;
  readonly employeeFilter: Autocomplete;
  readonly statusFilter: FormField;
  readonly searchButton: Locator;
  readonly resetButton: Locator;

  readonly addButton: Locator;
  readonly recordsFound: Locator;
  readonly tableHeader: Locator;
  readonly rows: Locator;
  readonly loadingSpinner: Locator;
  readonly pagination: Locator;

  constructor(readonly page: Page) {
    this.shell = new AppShell(page);
    this.toast = new Toast(page);
    this.dialog = new ConfirmDialog(page);

    this.filterPanel = page.locator('.oxd-table-filter');
    this.filterToggle = page.locator('.oxd-table-filter-header-options button');
    this.usernameFilter = new FormField(page, 'Username', this.filterPanel);
    this.roleFilter = new FormField(page, 'User Role', this.filterPanel);
    this.employeeFilter = new Autocomplete(page, 'Employee Name', this.filterPanel);
    this.statusFilter = new FormField(page, 'Status', this.filterPanel);
    this.searchButton = this.filterPanel.getByRole('button', { name: 'Search' });
    this.resetButton = this.filterPanel.getByRole('button', { name: 'Reset' });

    this.addButton = page.getByRole('button', { name: 'Add' });
    this.recordsFound = page.locator('.orangehrm-horizontal-padding span.oxd-text');
    this.tableHeader = page.locator('.oxd-table-header');
    this.rows = page.locator('.oxd-table-body .oxd-table-card');
    this.loadingSpinner = page.locator('.oxd-table-loader, .oxd-loading-spinner');
    this.pagination = page.locator('nav[aria-label="Pagination Navigation"], .oxd-pagination');
  }

  private isUsersListCall(r: Response): boolean {
    return r.url().includes(API.users) && !/\/admin\/users\/\d+/.test(r.url()) && r.request().method() === 'GET';
  }

  async goto(): Promise<void> {
    const listed = this.page.waitForResponse((r) => this.isUsersListCall(r));
    await this.page.goto(ROUTES.systemUsers);
    await listed;
    await this.waitForTable();
  }

  async waitForTable(): Promise<void> {
    await expect(this.recordsFound).toHaveText(/Records? Found/);
    await expect(this.loadingSpinner).toHaveCount(0);
  }

  /** Expands the filter panel only if it is collapsed. */
  async ensureFiltersExpanded(): Promise<void> {
    if (!(await this.usernameFilter.input.isVisible())) await this.filterToggle.click();
    await expect(this.usernameFilter.input).toBeVisible();
  }

  /** Clicks Search and resolves with the list API response it triggers. */
  async search(): Promise<Response> {
    const listed = this.page.waitForResponse((r) => this.isUsersListCall(r));
    await this.searchButton.click();
    const response = await listed;
    await this.waitForTable();
    return response;
  }

  async reset(): Promise<Response> {
    const listed = this.page.waitForResponse((r) => this.isUsersListCall(r));
    await this.resetButton.click();
    const response = await listed;
    await this.waitForTable();
    return response;
  }

  async filterByUsername(username: string): Promise<Response> {
    await this.ensureFiltersExpanded();
    await this.usernameFilter.fill(username);
    return this.search();
  }

  /** Parses "(n) Records Found"; "No Records Found" → 0. Call after waitForTable(). */
  async recordsFoundCount(): Promise<number> {
    const text = (await this.recordsFound.innerText()).trim();
    const match = text.match(/^\((\d+)\) Records? Found$/);
    return match ? Number(match[1]) : 0;
  }

  cell(row: Locator, column: Column): Locator {
    return row.locator(`.oxd-table-cell:nth-child(${COLUMN[column]})`);
  }

  /** All cells of one column across the rendered rows. */
  columnCells(column: Column): Locator {
    return this.rows.locator(`.oxd-table-cell:nth-child(${COLUMN[column]})`);
  }

  /**
   * Rows whose `column` equals `value` (exact string) or matches it (RegExp).
   * With `negate` it returns the rows that do NOT match — asserting that set has
   * count 0 is the web-first way to say "every row is X".
   */
  rowsWhere(column: Column, value: string | RegExp, negate = false): Locator {
    const matcher = this.page.locator(`.oxd-table-cell:nth-child(${COLUMN[column]})`, {
      hasText: typeof value === 'string' ? new RegExp(`^\\s*${escapeRegex(value)}\\s*$`) : value,
    });
    return negate ? this.rows.filter({ hasNot: matcher }) : this.rows.filter({ has: matcher });
  }

  rowByUsername(username: string): Locator {
    return this.rowsWhere('username', username);
  }

  editButton(row: Locator): Locator {
    return row.locator('.oxd-table-cell-actions button:has(i.bi-pencil-fill)');
  }

  deleteButton(row: Locator): Locator {
    return row.locator('.oxd-table-cell-actions button:has(i.bi-trash)');
  }

  async openEdit(username: string): Promise<void> {
    const row = this.rowByUsername(username);
    await expect(row).toHaveCount(1);
    await this.editButton(row).click();
    await this.page.waitForURL(/\/admin\/saveSystemUser\/\d+$/);
  }

  async openDelete(username: string): Promise<void> {
    const row = this.rowByUsername(username);
    await expect(row).toHaveCount(1);
    await this.deleteButton(row).click();
    await expect(this.dialog.root).toBeVisible();
  }

  async clickAdd(): Promise<void> {
    await this.addButton.click();
    await this.page.waitForURL(`**${ROUTES.saveSystemUser}`);
  }
}
