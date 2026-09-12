import { createElement, type ComponentType, type SVGProps } from "react";
import {
  Anchor, AtSign, BedDouble, Bus, CalendarDays, Camera, Car, Coffee, CreditCard, ExternalLink,
  Globe, KeyRound, Mail, MapPin, MessageCircle, MessageSquare, Phone, Plane, Send, Ship,
  ShoppingBag, Store, Ticket, UtensilsCrossed, Waves,
} from "lucide-react";
import {
  SiAirbnb, SiBookingdotcom, SiFacebook, SiInstagram, SiTiktok, SiTripadvisor, SiTripdotcom, SiYoutube,
} from "react-icons/si";

export type PlaceLinkIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Simple Icons marks (CC0) are filled 24×24 glyphs in currentColor. Agoda and Skyscanner are not
// in the set, so two local marks match the same canvas. Built with createElement (no JSX) so this
// module stays loadable by the plain-node test suite.
type MarkPath = { d: string; fillRule?: "evenodd" };
function markIcon(paths: MarkPath[]): PlaceLinkIconComponent {
  function MarkIcon(props: SVGProps<SVGSVGElement>) {
    return createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, focusable: "false", ...props },
      paths.map((path, index) => createElement("path", { key: index, d: path.d, ...(path.fillRule ? { fillRule: path.fillRule } : {}) })));
  }
  return MarkIcon;
}
const AgodaIcon = markIcon([
  { d: "M3.5 13a7 7 0 1 0 14 0a7 7 0 1 0 -14 0zM7.5 13a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z", fillRule: "evenodd" },
  { d: "M14 6h3.5v14H14z" },
]);
const SkyscannerIcon = markIcon([
  { d: "M22 4.2c-6 1-10.4 4.8-12 9.9-2.7.8-5.4.2-7.5-1.6 4 4.2 10.3 4.9 14.7 1.8 3-2.1 4.5-5.6 4.8-10.1z" },
]);

export type PlaceLinkIconOption = {
  // name is what gets stored in links_json; label auto-fills an empty link label;
  // platform (when set) auto-fills an empty link URL with the canonical site.
  name: string;
  label: string;
  Icon: PlaceLinkIconComponent;
  platform?: string;
};

// The platforms travelers actually book, price-check and share through — first stop in the picker.
export const PLATFORM_LINK_ICONS: PlaceLinkIconOption[] = [
  { name: "booking.com", label: "Booking.com", Icon: SiBookingdotcom, platform: "https://www.booking.com" },
  { name: "agoda", label: "Agoda", Icon: AgodaIcon, platform: "https://www.agoda.com" },
  { name: "airbnb", label: "Airbnb", Icon: SiAirbnb, platform: "https://www.airbnb.com" },
  { name: "facebook", label: "Facebook", Icon: SiFacebook, platform: "https://www.facebook.com" },
  { name: "instagram", label: "Instagram", Icon: SiInstagram, platform: "https://www.instagram.com" },
  { name: "tiktok", label: "TikTok", Icon: SiTiktok, platform: "https://www.tiktok.com" },
  { name: "youtube", label: "YouTube", Icon: SiYoutube, platform: "https://www.youtube.com" },
  { name: "skyscanner", label: "Skyscanner", Icon: SkyscannerIcon, platform: "https://www.skyscanner.net" },
  { name: "tripadvisor", label: "TripAdvisor", Icon: SiTripadvisor, platform: "https://www.tripadvisor.com" },
  { name: "trip.com", label: "Trip.com", Icon: SiTripdotcom, platform: "https://www.trip.com" },
];

// Generic Lucide marks for everything that is not a named platform.
export const GENERIC_LINK_ICONS: PlaceLinkIconOption[] = [
  { name: "Globe", label: "Website", Icon: Globe },
  { name: "ExternalLink", label: "Link", Icon: ExternalLink },
  { name: "BedDouble", label: "Booking", Icon: BedDouble },
  { name: "KeyRound", label: "Book direct", Icon: KeyRound },
  { name: "CalendarDays", label: "Reservations", Icon: CalendarDays },
  { name: "Ticket", label: "Tickets", Icon: Ticket },
  { name: "CreditCard", label: "Payment", Icon: CreditCard },
  { name: "Phone", label: "Call", Icon: Phone },
  { name: "MessageCircle", label: "Chat", Icon: MessageCircle },
  { name: "MessageSquare", label: "Messenger", Icon: MessageSquare },
  { name: "Mail", label: "Email", Icon: Mail },
  { name: "AtSign", label: "Social", Icon: AtSign },
  { name: "Send", label: "Message", Icon: Send },
  { name: "MapPin", label: "Location", Icon: MapPin },
  { name: "Camera", label: "Photo tour", Icon: Camera },
  { name: "UtensilsCrossed", label: "Food & drinks", Icon: UtensilsCrossed },
  { name: "Coffee", label: "Cafe", Icon: Coffee },
  { name: "Ship", label: "Boat", Icon: Ship },
  { name: "Waves", label: "Beach", Icon: Waves },
  { name: "Anchor", label: "Dock", Icon: Anchor },
  { name: "Bus", label: "Bus", Icon: Bus },
  { name: "Car", label: "Transfer", Icon: Car },
  { name: "Plane", label: "Airport", Icon: Plane },
  { name: "Store", label: "Shop", Icon: Store },
  { name: "ShoppingBag", label: "Market", Icon: ShoppingBag },
];

export const PLACE_LINK_ICONS: PlaceLinkIconOption[] = [...PLATFORM_LINK_ICONS, ...GENERIC_LINK_ICONS];

export const PLACE_LINK_ICON_NAMES = PLACE_LINK_ICONS.map((option) => option.name);

export function placeLinkIconOption(name?: string): PlaceLinkIconOption | undefined {
  return PLACE_LINK_ICONS.find((option) => option.name === name);
}

// Fallbacks (unknown or missing names) render as a generic link, never a broken icon.
export function placeLinkIcon(name?: string): PlaceLinkIconComponent {
  return placeLinkIconOption(name)?.Icon ?? ExternalLink;
}
