import { ForbiddenException } from '@nestjs/common';

/** Great-circle distance between two lat/lng points, in metres (haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface GeofenceConfig {
  geofenceEnabled: boolean;
  geofenceLatitude: number | null;
  geofenceLongitude: number | null;
  geofenceRadiusMeters: number;
}

export interface Coords {
  latitude?: number;
  longitude?: number;
}

/**
 * Enforces a merchant's geofence rule for a workstation action (staff login /
 * clock-in). No-op when geofencing is disabled or not fully configured. When
 * enabled, requires the caller's coordinates and that they fall within the
 * radius — otherwise throws 403 with a clear message. `action` is woven into
 * the error text (e.g. "log in", "clock in").
 */
export function assertWithinGeofence(
  config: GeofenceConfig | null | undefined,
  coords: Coords | undefined,
  action = 'do this',
): void {
  if (!config?.geofenceEnabled) return;
  // If the merchant enabled the rule but never set a centre, fail open rather
  // than locking everyone out of a misconfigured store.
  if (config.geofenceLatitude == null || config.geofenceLongitude == null) {
    return;
  }
  if (
    coords?.latitude == null ||
    coords?.longitude == null ||
    Number.isNaN(coords.latitude) ||
    Number.isNaN(coords.longitude)
  ) {
    throw new ForbiddenException(
      `Location is required to ${action}. Enable location access and try again.`,
    );
  }
  const dist = distanceMeters(
    Number(config.geofenceLatitude),
    Number(config.geofenceLongitude),
    coords.latitude,
    coords.longitude,
  );
  const radius = Number(config.geofenceRadiusMeters) || 100;
  if (dist > radius) {
    throw new ForbiddenException(
      `You must be within the work environment to ${action}.`,
    );
  }
}
