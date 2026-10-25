import * as Location from 'expo-location';

export interface Coords {
  lat: number;
  lng: number;
  address: string | null;
}

/** Asks for permission and returns the device position plus a readable address when available. */
export async function getCurrentCoords(): Promise<Coords> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) {
    throw new Error('Location permission is required. Enable it in your device settings.');
  }

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;

  let address: string | null = null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (place) {
      address =
        [place.name, place.street, place.district, place.city].filter(Boolean).join(', ') || null;
    }
  } catch {
    // Reverse geocoding is a nicety; coordinates alone are enough.
  }

  return { lat: latitude, lng: longitude, address };
}

/** Looks up coordinates for a typed address (used when the donor does not share GPS). */
export async function geocodeAddress(address: string): Promise<Coords> {
  // Android requires location permission before geocoding; iOS ignores it.
  await Location.requestForegroundPermissionsAsync();
  let point: Location.LocationGeocodedLocation | undefined;
  try {
    [point] = await Location.geocodeAsync(address);
  } catch {
    point = undefined;
  }
  if (!point) {
    throw new Error('Could not find that address. Add a landmark or tap "Use my current location".');
  }
  return { lat: point.latitude, lng: point.longitude, address };
}
