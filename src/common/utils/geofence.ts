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
  /** Legacy single centre, kept for a store that has no places listed yet. */
  geofenceLatitude: number | null;
  geofenceLongitude: number | null;
  geofenceRadiusMeters: number;
}

/** One place staff may work from. A store may have several. */
export interface GeofenceLocation {
  label?: string;
  latitude: number | string;
  longitude: number | string;
  radiusMeters?: number | null;
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
  locations: GeofenceLocation[] = [],
): void {
  if (!config?.geofenceEnabled) return;

  // A store may work from several places — a dining room and a kitchen unit
  // down the road — and being at any of them counts. The single centre on the
  // settings record is the legacy shape, used only while a store has no
  // places listed.
  const places: GeofenceLocation[] = locations.length
    ? locations
    : config.geofenceLatitude != null && config.geofenceLongitude != null
      ? [
          {
            latitude: config.geofenceLatitude,
            longitude: config.geofenceLongitude,
            radiusMeters: config.geofenceRadiusMeters,
          },
        ]
      : [];

  // Enabled but nowhere defined: fail open rather than locking everyone out
  // of a half-configured store.
  if (places.length === 0) return;

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

  const inside = places.some((place) => {
    const dist = distanceMeters(
      Number(place.latitude),
      Number(place.longitude),
      coords.latitude!,
      coords.longitude!,
    );
    return dist <= (Number(place.radiusMeters) || 100);
  });
  if (!inside) {
    throw new ForbiddenException(
      `You must be within the work environment to ${action}.`,
    );
  }
}
