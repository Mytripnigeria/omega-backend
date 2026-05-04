export interface AdminJwtPayload {
  sub: string;
  sub_type: 'admin';
  email: string;
  businessId: string;
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

export type JwtPayload = AdminJwtPayload | StaffJwtPayload;
