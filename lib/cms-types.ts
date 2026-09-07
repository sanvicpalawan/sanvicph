import type { DiscoverCategory, Community, Opportunity } from "./sanvic-data";

export type SiteCopy = Record<string, string>;

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
  status: "draft" | "published" | "archived";
  featured: boolean;
  verified: boolean;
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

export type JourneyBadge = { id: string; name: string; description: string; rule: string; threshold: number; mediaIds?: string[] };

export type PublicSiteData = {
  copy: SiteCopy;
  communities: Community[];
  categories: DiscoverCategory[];
  opportunities: Opportunity[];
  badges: JourneyBadge[];
  places: Place[];
  media: MediaAsset[];
};

export type AdminContentRow = { key: string; section: string; label: string; draftValue: string; publishedValue: string; sortOrder: number; updatedAt: number };
export type AdminItem = { id: string; kind: string; slug: string; title: string; data: Record<string, unknown>; status: string; sortOrder: number; createdAt: number; updatedAt: number };
