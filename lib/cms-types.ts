import type { DiscoverCategory, Community, Opportunity } from "./sanvic-data";

export type SiteCopy = Record<string, string>;

export type RoomAmenityGroup = { title: string; items: string[] };

export type PlaceRoom = {
  id: string;
  name: string;
  units?: number;
  size?: string;
  beds?: string;
  description?: string;
  chips?: string[];
  groups?: RoomAmenityGroup[];
  photoIds: string[];
  rateFrom?: number | null;
  rateNote?: string;
};

export type Place = {
  id: string;
  name: string;
  type: string;
  barangay: string;
  googleMapsUrl: string;
  googlePlaceId: string;
  sourceLatitude: number | null;
  sourceLongitude: number | null;
  displayLatitude: number;
  displayLongitude: number;
  address: string;
  phone: string;
  website: string;
  description: string;
  bookingUrl: string;
  coverMediaId: string;
  photoIds: string[];
  menuIds: string[];
  discoverSections: string[];
  rooms?: PlaceRoom[];
  importBatchId?: string;
  importSourceKey?: string | null;
  sourceRecordId?: string;
  sourceFolder?: string;
  importWarnings?: string[];
  status: "draft" | "published" | "archived";
  featured: boolean;
  verified: boolean;
  proActive?: boolean;
  ownerDetails?: { hours?: string; amenities?: string; services?: string; offers?: string; social?: string; closure?: string };
  sortOrder: number;
  createdAt?: number;
  updatedAt?: number;
};

export type MediaAsset = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  caption: string;
  altText: string;
  status: string;
  createdAt: number;
  url: string;
  downloadUrl: string;
};

export type JourneyBadge = { id: string; name: string; description: string; rule: string; threshold: number; targetId?: string; mediaIds?: string[] };
export type Traveler = { id:string; nickname:string };
export type TravelerUpload = { id:string; opportunityId:string; filename?:string; caption:string; status?:"pending"|"published"|"rejected"; createdAt:number; url:string; nickname?:string };
export type OnboardingOption = { id:string; title:string; description:string; stage:"identity"|"mood"|"interest"; audience:"all"|"visitor"|"local"; route:string; image:string; mediaIds?:string[] };

export type PublicSiteData = {
  copy: SiteCopy;
  communities: Community[];
  categories: DiscoverCategory[];
  opportunities: Opportunity[];
  badges: JourneyBadge[];
  onboarding: OnboardingOption[];
  places: Place[];
  media: MediaAsset[];
  travelerExperiences?: TravelerUpload[];
};

export type AdminContentRow = { key: string; section: string; label: string; draftValue: string; publishedValue: string; sortOrder: number; updatedAt: number };
export type AdminItem = { id: string; kind: string; slug: string; title: string; data: Record<string, unknown>; status: string; sortOrder: number; createdAt: number; updatedAt: number };
export type LocationImport = { id:string; filename:string; documentName:string; status:string; totalPlacemarks:number; pointCount:number; importedCount:number; duplicateCount:number; ignoredCount:number; warningCount:number; createdAt:number };
export type AdminTravelerUpload = TravelerUpload & { nickname:string };
