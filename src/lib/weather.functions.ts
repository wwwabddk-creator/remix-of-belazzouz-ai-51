import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getWeather = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ lat: z.number(), lon: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${data.lat}&longitude=${data.lon}&current=temperature_2m,weather_code,wind_speed_10m`;
    const r = await fetch(url);
    if (!r.ok) return { ok: false as const };
    const j = await r.json();
    return { ok: true as const, temp: j?.current?.temperature_2m, code: j?.current?.weather_code, wind: j?.current?.wind_speed_10m };
  });
