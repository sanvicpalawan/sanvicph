import {
  Anchor, AtSign, BedDouble, Bus, CalendarDays, Camera, Car, Coffee, CreditCard, ExternalLink,
  Globe, KeyRound, Mail, MapPin, MessageCircle, MessageSquare, Phone, Plane, Send, Ship,
  ShoppingBag, Store, Ticket, UtensilsCrossed, Waves,
  type LucideIcon,
} from "lucide-react";

export type PlaceLinkIconOption = { name: string; Icon: LucideIcon };

// Curated set of modern Lucide icons offered in the admin "Links" icon picker.
// The admin stores only the icon name; this is the single list of allowed names, so the
// public page always resolves a known component and the server can whitelist saves.
// Brand icons are intentionally absent — they were removed from Lucide v1.
export const PLACE_LINK_ICONS: PlaceLinkIconOption[] = [
  { name: "Globe", Icon: Globe },
  { name: "ExternalLink", Icon: ExternalLink },
  { name: "BedDouble", Icon: BedDouble },
  { name: "KeyRound", Icon: KeyRound },
  { name: "CalendarDays", Icon: CalendarDays },
  { name: "Ticket", Icon: Ticket },
  { name: "CreditCard", Icon: CreditCard },
  { name: "Phone", Icon: Phone },
  { name: "MessageCircle", Icon: MessageCircle },
  { name: "MessageSquare", Icon: MessageSquare },
  { name: "Mail", Icon: Mail },
  { name: "AtSign", Icon: AtSign },
  { name: "Send", Icon: Send },
  { name: "MapPin", Icon: MapPin },
  { name: "Camera", Icon: Camera },
  { name: "UtensilsCrossed", Icon: UtensilsCrossed },
  { name: "Coffee", Icon: Coffee },
  { name: "Ship", Icon: Ship },
  { name: "Waves", Icon: Waves },
  { name: "Anchor", Icon: Anchor },
  { name: "Bus", Icon: Bus },
  { name: "Car", Icon: Car },
  { name: "Plane", Icon: Plane },
  { name: "Store", Icon: Store },
  { name: "ShoppingBag", Icon: ShoppingBag },
];

export const PLACE_LINK_ICON_NAMES = PLACE_LINK_ICONS.map((option) => option.name);

// Fallbacks (unknown or missing names) render as a generic external link, never a broken icon.
export function placeLinkIcon(name?: string): LucideIcon {
  return PLACE_LINK_ICONS.find((option) => option.name === name)?.Icon ?? ExternalLink;
}
