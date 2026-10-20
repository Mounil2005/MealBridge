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
