/**
 * Merchant-dashboard permissions.
 *
 * A merchant can grant one of their staff a dashboard login (see
 * `POST /staff/:id/dashboard-access`) restricted to particular modules. The
 * granularity is **the module**, matching the hub's sidebar 1:1, with a
 * read/write split:
 *
 *   <module>.view    — may open the module's screens
 *   <module>.manage  — may also create/edit/delete in it (implies `.view`)
 *
 * Why modules and not individual screens: several screens share the same
 * endpoints, so per-screen rules could only ever be enforced by hiding menu
 * items — the API would still answer. Module rules map onto route prefixes, so
 * what the UI hides, the server actually refuses.
 *
 * This file is the single source of truth: the catalogue the hub renders, the
 * route→module map the guard enforces, and the implication rules all live here
 * so they cannot drift apart.
 */

export const DASHBOARD_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Orders' },
  { key: 'stocks', label: 'Stocks' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'customers', label: 'Customers' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'operations', label: 'Operations' },
  { key: 'hr', label: 'HR' },
  { key: 'reports', label: 'Reports' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'storefront', label: 'Storefront' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'workstation', label: 'Workstation' },
  { key: 'settings', label: 'Settings' },
] as const;

export type DashboardModule = (typeof DASHBOARD_MODULES)[number]['key'];

/** Wildcard granting everything — what the business owner effectively holds. */
export const ALL_ACCESS = 'all';

/** Every valid permission string, for validating a grant. */
export const DASHBOARD_PERMISSIONS: string[] = [
  ALL_ACCESS,
  ...DASHBOARD_MODULES.flatMap((m) => [`${m.key}.view`, `${m.key}.manage`]),
];

interface RouteRule {
  /** Controller path prefix, without a leading slash. */
  prefix: string;
  module: DashboardModule;
  /**
   * Reads on this prefix are allowed for every dashboard login regardless of
   * module. Reserved for shared reference data that other modules' screens
   * depend on — a stock-less marketing user still needs the category list to
   * build a discount, and everyone needs the store switcher to work at all.
   * Writes are still gated on `<module>.manage`.
   */
  readOpen?: boolean;
}

/**
 * Route prefix → module. Matched longest-prefix-first, so `reports/dashboard`
 * wins over `reports`.
 *
 * Prefixes that appear nowhere here are unrestricted: authentication, file
 * uploads, payment-gateway callbacks, the public storefront, and the
 * customer/staff self-service surfaces. They are either not dashboard
 * functionality or are already guarded by a different token type.
 */
const ROUTE_RULES: RouteRule[] = ([
  // The Dashboard home is powered by one reports endpoint; it must not require
  // access to the whole Reports module.
  { prefix: 'reports/dashboard', module: 'dashboard' },
  { prefix: 'reports', module: 'reports' },
  { prefix: 'reviews', module: 'reports' },

  { prefix: 'orders', module: 'orders' },
  { prefix: 'transactions', module: 'orders' },
  { prefix: 'cash-sessions', module: 'orders' },

  { prefix: 'products', module: 'stocks' },
  { prefix: 'categories', module: 'stocks', readOpen: true },
  { prefix: 'ingredients', module: 'stocks' },
  { prefix: 'addon-groups', module: 'stocks' },
  { prefix: 'combos', module: 'stocks' },

  { prefix: 'inventory-locations', module: 'procurement', readOpen: true },
  { prefix: 'stock-transfers', module: 'procurement' },
  { prefix: 'equipment', module: 'procurement' },

  { prefix: 'suppliers', module: 'suppliers', readOpen: true },
  { prefix: 'customers', module: 'customers' },

  { prefix: 'coupons', module: 'marketing' },
  { prefix: 'loyalty', module: 'marketing' },
  { prefix: 'referrals', module: 'marketing' },

  { prefix: 'tables', module: 'operations' },
  { prefix: 'checklists', module: 'operations' },
  { prefix: 'kpi-targets', module: 'operations' },
  { prefix: 'expenses', module: 'operations' },

  { prefix: 'staff', module: 'hr' },
  { prefix: 'roles', module: 'hr', readOpen: true },
  { prefix: 'shifts', module: 'hr' },
  { prefix: 'payslips', module: 'hr' },

  { prefix: 'bookings', module: 'bookings' },
  { prefix: 'reservations', module: 'bookings' },
  { prefix: 'events', module: 'bookings' },

  { prefix: 'payouts', module: 'payouts' },
  { prefix: 'merchant-wallet', module: 'payouts' },

  { prefix: 'storefront', module: 'storefront' },
  { prefix: 'domains', module: 'storefront' },

  { prefix: 'integrations', module: 'plugins' },
  { prefix: 'webhooks', module: 'plugins' },

  { prefix: 'workstation-settings', module: 'workstation' },
  { prefix: 'workstation', module: 'workstation' },
  { prefix: 'activity-log', module: 'workstation' },
  { prefix: 'printers', module: 'workstation' },
  { prefix: 'deliveries', module: 'workstation' },
  { prefix: 'delivery-regions', module: 'workstation', readOpen: true },

  // Shared reference data every screen leans on — the store switcher, currency
  // and branding, tax rates on a product form, payment methods on an order.
  { prefix: 'stores', module: 'settings', readOpen: true },
  { prefix: 'business', module: 'settings', readOpen: true },
  { prefix: 'tax-rates', module: 'settings', readOpen: true },
  { prefix: 'payment-methods', module: 'settings', readOpen: true },
  { prefix: 'notifications', module: 'settings' },
] as RouteRule[]).sort((a, b) => b.prefix.length - a.prefix.length);

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The permission a request needs, or `null` when the route is unrestricted.
 *
 * `path` is the request path with any global prefix already stripped
 * (e.g. `products/123/variations`).
 */
export function requiredPermissionFor(
  method: string,
  path: string,
): string | null {
  const normalised = path.replace(/^\/+/, '').split('?')[0];
  const rule = ROUTE_RULES.find(
    (r) => normalised === r.prefix || normalised.startsWith(`${r.prefix}/`),
  );
  if (!rule) return null;

  const isRead = READ_METHODS.has(method.toUpperCase());
  if (isRead && rule.readOpen) return null;
  return `${rule.module}.${isRead ? 'view' : 'manage'}`;
}

/**
 * Whether a granted permission set satisfies `required`.
 *
 * `manage` implies `view`, and `all` implies everything, so a grant of
 * "stocks.manage" alone is enough to both open and edit the Stocks module.
 */
export function satisfies(granted: string[], required: string): boolean {
  if (granted.includes(ALL_ACCESS)) return true;
  if (granted.includes(required)) return true;
  if (required.endsWith('.view')) {
    return granted.includes(`${required.slice(0, -'.view'.length)}.manage`);
  }
  return false;
}
