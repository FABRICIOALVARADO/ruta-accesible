export interface User { id: number; name: string; email: string; role: 'member' | 'admin'; }
export interface Option { id: string; name: string; }
export interface Catalogs {
  districts: Option[]; categories: Option[]; facilities: Option[];
  report_types: Option[]; report_statuses: Option[]; travel_modes: Option[];
}
export interface Config { maps_key: string; map_id: string; catalogs: Catalogs; }
export interface Point { lat: number; lng: number; }
export interface PlaceInput extends Point {
  name: string; category_id: string; district_id: string; address: string; description: string;
  image: string; facilities: string[]; is_demo: boolean; verified: boolean;
}
export interface Place extends Omit<PlaceInput, 'verified'> {
  id: number; category: string; district: string; rating: number | null; review_count: number;
  archived_at: string | null; verified_at: string | null;
}
export interface Review {
  id: number; rating: number; comment: string; author: string; mine: 0 | 1; created_at: string;
}
export interface Detail { place: Place; reviews: Review[]; }
export type ReportStatus = 'pending' | 'reviewing' | 'resolved';
export interface ReportInput {
  title: string; description: string; place_id: number | null; location: string | null; type_id: string;
  lat?:number; lng?:number;
}
export interface BarrierReport extends ReportInput {
  id: number; status_id: ReportStatus; created_at: string; place_name: string | null; author: string;
}
export interface ReportEvent { status_id: ReportStatus; changed_at: string; }
export type Mode = 'walking' | 'driving' | 'bicycling' | 'transit';
export interface TripInput { name: string; origin: string; destination: string; mode_id: Mode; }
export interface SavedTrip extends TripInput { id: number; }
export interface Summary { places: number; users: number; reports: number; reviews: number; routes: number; }
export interface Filters { q?: string; district?: string; category?: string; facility?: string[]; verified?: boolean; }
