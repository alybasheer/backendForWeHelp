import { Injectable, Logger } from '@nestjs/common';

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polyline: number[][];
}

export interface RoutingError {
  error: string;
  distanceKm: number;
  durationMinutes: number;
  polyline: null;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org';
  }

  private async fetchOsrm<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`OSRM responded ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    if (data.code !== 'Ok') {
      throw new Error(`OSRM error: ${data.code} - ${data.message ?? ''}`);
    }
    return data;
  }

  async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    profile: 'driving' | 'walking' | 'cycling' = 'driving',
  ): Promise<RouteResult> {
    const url =
      `${this.baseUrl}/route/v1/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=false`;
    const data: any = await this.fetchOsrm(url);
    const leg = data.routes[0];
    return {
      distanceKm: +(leg.distance / 1000).toFixed(2),
      durationMinutes: +(leg.duration / 60).toFixed(1),
      polyline: leg.geometry.coordinates.map((c: number[]) => [c[1], c[0]]),
    };
  }

  async getRouteSafe(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    profile: 'driving' | 'walking' | 'cycling' = 'driving',
    fallbackStraightLineKm?: number,
  ): Promise<RouteResult | null> {
    try {
      return await this.getRoute(origin, destination, profile);
    } catch (err: any) {
      this.logger.warn(`OSRM route failed: ${err.message}`);
      if (fallbackStraightLineKm !== undefined) {
        const estimatedMinutes = Math.max(1, Math.round(fallbackStraightLineKm / 30 * 60));
        return {
          distanceKm: fallbackStraightLineKm,
          durationMinutes: estimatedMinutes,
          polyline: [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ],
        };
      }
      return null;
    }
  }

  async getDistanceMatrix(
    origin: { latitude: number; longitude: number },
    destinations: { latitude: number; longitude: number }[],
    profile: 'driving' | 'walking' | 'cycling' = 'driving',
  ): Promise<(RouteResult | RoutingError)[]> {
    if (destinations.length === 0) return [];
    const maxBatch = 25;
    const results: (RouteResult | RoutingError)[] = [];

    for (let i = 0; i < destinations.length; i += maxBatch) {
      const batch = destinations.slice(i, i + maxBatch);
      const coordsStr = [
        `${origin.longitude},${origin.latitude}`,
        ...batch.map((d) => `${d.longitude},${d.latitude}`),
      ].join(';');
      const url = `${this.baseUrl}/table/v1/${profile}/${coordsStr}?sources=0&annotations=distance,duration`;
      try {
        const data: any = await this.fetchOsrm(url);
        for (let j = 0; j < batch.length; j++) {
          const dist = data.distances[0][j + 1];
          const dur = data.durations[0][j + 1];
          if (dist !== null && dur !== null) {
            results.push({
              distanceKm: +(dist / 1000).toFixed(2),
              durationMinutes: +(dur / 60).toFixed(1),
              polyline: [],
            });
          } else {
            results.push({ error: 'No route', distanceKm: 0, durationMinutes: 0, polyline: null });
          }
        }
      } catch {
        this.logger.warn(`OSRM table failed for batch ${i}`);
        for (let j = 0; j < batch.length; j++) {
          results.push({ error: 'No route', distanceKm: 0, durationMinutes: 0, polyline: null });
        }
      }
    }
    return results;
  }
}
