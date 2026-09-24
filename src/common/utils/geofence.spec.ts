import { ForbiddenException } from '@nestjs/common';
import { assertWithinGeofence, distanceMeters } from './geofence';

/**
 * Round-13 feedback, Workstation (Settings):
 *  - "Geofencing settings should allow multiple locations added to each stores"
 *
 * A branch is not one point: a dining room and a kitchen unit down the road
 * are both "at work". Being inside ANY of a store's places passes.
 */
const ON = {
  geofenceEnabled: true,
  geofenceLatitude: null,
  geofenceLongitude: null,
  geofenceRadiusMeters: 100,
};
// Two places ~1.5 km apart in Makurdi.
const diningRoom = { label: 'Dining room', latitude: 7.7337, longitude: 8.5214, radiusMeters: 150 };
const kitchen = { label: 'Kitchen unit', latitude: 7.7450, longitude: 8.5300, radiusMeters: 150 };

const inside = { latitude: 7.7338, longitude: 8.5215 };
const atKitchen = { latitude: 7.7451, longitude: 8.5301 };
const acrossTown = { latitude: 7.8000, longitude: 8.6000 };

describe('assertWithinGeofence with several places', () => {
  it('lets staff in at the first place', () => {
    expect(() =>
      assertWithinGeofence(ON, inside, 'log in', [diningRoom, kitchen]),
    ).not.toThrow();
  });

  it('lets staff in at any other place', () => {
    expect(() =>
      assertWithinGeofence(ON, atKitchen, 'log in', [diningRoom, kitchen]),
    ).not.toThrow();
  });

  it('keeps out someone who is at neither', () => {
    expect(() =>
      assertWithinGeofence(ON, acrossTown, 'log in', [diningRoom, kitchen]),
    ).toThrow(/must be within the work environment to log in/);
  });

  it('uses each place’s own radius', () => {
    // `atKitchen` is ~15 m from the centre: inside a 50 m fence, outside a 5 m one.
    const generous = { ...kitchen, radiusMeters: 50 };
    const tight = { ...kitchen, radiusMeters: 5 };

    expect(() => assertWithinGeofence(ON, atKitchen, 'clock in', [generous])).not.toThrow();
    expect(() => assertWithinGeofence(ON, atKitchen, 'clock in', [tight])).toThrow(
      ForbiddenException,
    );
  });

  it('asks for location when the rule is on and none was sent', () => {
    expect(() => assertWithinGeofence(ON, undefined, 'clock in', [diningRoom])).toThrow(
      /Location is required to clock in/,
    );
  });
});

describe('assertWithinGeofence without places', () => {
  it('does nothing at all when the rule is off', () => {
    expect(() =>
      assertWithinGeofence({ ...ON, geofenceEnabled: false }, acrossTown, 'log in', [diningRoom]),
    ).not.toThrow();
  });

  it('falls back to the legacy single centre for a store with no places yet', () => {
    const legacy = {
      geofenceEnabled: true,
      geofenceLatitude: 7.7337,
      geofenceLongitude: 8.5214,
      geofenceRadiusMeters: 150,
    };

    expect(() => assertWithinGeofence(legacy, inside, 'log in')).not.toThrow();
    expect(() => assertWithinGeofence(legacy, acrossTown, 'log in')).toThrow(ForbiddenException);
  });

  it('fails open rather than locking a half-configured store out', () => {
    // Enabled, but the merchant never added anywhere to be.
    expect(() => assertWithinGeofence(ON, acrossTown, 'log in', [])).not.toThrow();
  });

  it('measures real distance', () => {
    // ~1.5 km between the two places above.
    const d = distanceMeters(
      diningRoom.latitude, diningRoom.longitude, kitchen.latitude, kitchen.longitude,
    );
    expect(d).toBeGreaterThan(1200);
    expect(d).toBeLessThan(2000);
  });
});
