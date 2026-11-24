import type { Coordinate } from './mobility';
import type { Point } from './models';

export const huancayoCenter: Coordinate = [-12.0697, -75.2101];
export const huancayoZoom = 16;
export const routeZoom = 17;

export interface MapLine {
  path: Coordinate[];
  color: string;
  weight: number;
  opacity?: number;
  dashed?: boolean;
  select?: () => void;
}

export interface MapDot {
  point: Point;
  label: string;
  color: string;
  radius: number;
  select?: () => void;
}

export interface MapViewport {
  clear(): void;
  line(feature: MapLine): void;
  dot(feature: MapDot): void;
  fit(path: Coordinate[]): void;
  setPicking(active: boolean): void;
  zoom(delta: number): void;
  close(): void;
}
