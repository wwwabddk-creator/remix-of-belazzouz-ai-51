import { useCallback, useEffect, useState } from "react";

export type GeoPlace = {
  lat: number;
  lon: number;
  accuracy?: number;
  state?: string;
  municipality?: string;
  suburb?: string;
  country?: string;
  display?: string;
};

type NominatimAddress = {
  state?: string;
  region?: string;
  province?: string;
  state_district?: string;
  county?: string;
  municipality?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  city_district?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  country?: string;
};

async function reverseNominatim(lat: number, lon: number, lang: string): Promise<GeoPlace | null> {
  // zoom=18 = building level → maximises chance of returning municipality + state
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=${lang}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const j = (await res.json()) as { display_name?: string; address?: NominatimAddress };
  const a = j.address || {};
  return {
    lat,
    lon,
    state: a.state || a.state_district || a.region || a.province,
    municipality:
      a.municipality ||
      a.city ||
      a.town ||
      a.village ||
      a.hamlet ||
      a.county ||
      a.city_district,
    suburb: a.suburb || a.neighbourhood || a.quarter,
    country: a.country,
    display: j.display_name,
  };
}

// High-precision reverse-geocoder (free, no key).
// Strategy: enableHighAccuracy GPS + Nominatim zoom=18 + BigDataCloud fallback.
export function useGeoLocation(lang: "en" | "ar" = "en") {
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("geolocation_unavailable");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        try {
          let p = await reverseNominatim(lat, lon, lang);
          // Fallback: BigDataCloud (free, no key, CORS-enabled) if Nominatim missed key fields
          if (!p || (!p.state && !p.municipality)) {
            try {
              const r = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`,
              );
              if (r.ok) {
                const b = (await r.json()) as {
                  principalSubdivision?: string;
                  locality?: string;
                  city?: string;
                  countryName?: string;
                  localityInfo?: { administrative?: Array<{ name?: string; adminLevel?: number }> };
                };
                const admins = b.localityInfo?.administrative || [];
                const muni =
                  admins.find((x) => x.adminLevel === 8)?.name ||
                  admins.find((x) => x.adminLevel === 7)?.name ||
                  b.locality ||
                  b.city;
                p = {
                  lat,
                  lon,
                  state: p?.state || b.principalSubdivision,
                  municipality: p?.municipality || muni,
                  country: p?.country || b.countryName,
                  display: p?.display,
                };
              }
            } catch {
              /* ignore */
            }
          }
          if (p) setPlace({ ...p, accuracy });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [lang]);

  useEffect(() => {
    locate();
  }, [locate]);

  return { place, error, loading, refresh: locate };
}
