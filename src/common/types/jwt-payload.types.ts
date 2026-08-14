export interface AdminJwtPayload {
  sub: string;
  sub_type: 'admin';
  email: string;
  businessId: string;
  /**
   * Stores this dashboard login may work in. Absent/null means the whole
   * business (the owner); a staff member granted dashboard access is normally
   * restricted to the store(s) they work at.
   */
  storeIds?: string[] | null;
  /**
   * Dashboard module permissions. Absent/null means unrestricted (the owner);
   * a staff-granted login carries an explicit list.
   */
  permissions?: string[] | null;
  sessionId?: string;
}

export interface StaffJwtPayload {
  sub: string;
  sub_type: 'staff';
  staffCode: string;
  businessId: string;
  storeId: string;
  roleId: string;
  permissions: string[];
}

export interface UserJwtPayload {
  sub: string;
  sub_type: 'user';
  email: string;
  businessId: string;
  customerId: string;
}

export type JwtPayload = AdminJwtPayload | StaffJwtPayload | UserJwtPayload;
