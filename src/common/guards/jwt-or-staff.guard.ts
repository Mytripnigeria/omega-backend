import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Allows requests authenticated with either an admin JWT or a staff JWT.
 * Used for read-only endpoints shared between the merchant hub (admin)
 * and the workstation app (staff).
 */
@Injectable()
export class JwtOrStaffGuard extends AuthGuard(['admin-jwt', 'staff-jwt']) {}
