import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";

type XmlNode = Record<string, unknown>;

export type KmzLocation = {
  name: string;
  type: string;
  barangay: string;
  latitude: number;
  longitude: number;
  description: string;
  sourceRecordId: string;
  sourceFolder: string;
  sourceKeySeed: string;
  warnings: string[];
};

export type KmzParseResult = {
  documentName: string;
  totalPlacemarks: number;
  ignoredCount: number;
  locations: KmzLocation[];
};

const asArray = <T>(value: T | T[] | undefined): T[] => value == null ? [] : Array.isArray(value) ? value : [value];

function valueText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const node = value as XmlNode;
    return valueText(node["#text"] ?? node["#cdata"] ?? "");
  }
  return "";
}

function cleanDescription(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^description:\s*/i, "")
    .replace(/\nid:\s*[^\n]+$/i, "")
    .trim()
    .slice(0, 5000);
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function barangayFromFolder(folder: string): string {
  const key = normalize(folder);
  if (key.includes("port barton")) return "Port Barton";
  if (key.includes("new agutaya")) return "New Agutaya";
  if (key.includes("alimanguan")) return "Alimanguan";
  if (key.includes("san isidro")) return "San Isidro";
  if (key.includes("sto nino") || key.includes("santo nino")) return "Sto. Niño";
  if (key.includes("poblacion")) return "Poblacion";
  if (key.includes("kemdeng")) return "Kemdeng";
  if (key.includes("caruray")) return "Caruray";
  if (key.includes("new canipo")) return "New Canipo";
  if (key.includes("binga")) return "Binga";
  return "Unassigned";
}

function inferType(name: string, description: string): string {
  const text = normalize(`${name} ${description}`);
  if (/\b(resort|hotel|inn|lodge|guesthouse|guest house|homestay|hostel|cottages?|villa|rooms?|pension|huts?|camp)\b/.test(text)) return "Accommodation";
  if (/\b(cafe|coffee|bakery)\b/.test(text)) return "Cafe";
  if (/\b(restaurant|resto|grill|bistro|kitchen|pizza|eatery)\b/.test(text)) return "Restaurant";
  if (/\b(tour|tours|travel|excursion)\b/.test(text)) return "Tour";
  if (/\b(transport|transfer|van hire|car hire)\b/.test(text)) return "Transport";
  if (/\b(beach)\b/.test(text) && !/\b(resort|hotel|inn|lodge|guest|homestay|hostel|cottages?|villa|rooms?)\b/.test(text)) return "Beach";
  return "Accommodation";
}

function dataFields(placemark: XmlNode): Record<string, string> {
  const extended = placemark.ExtendedData as XmlNode | undefined;
  const entries = asArray(extended?.Data as XmlNode | XmlNode[] | undefined);
  return Object.fromEntries(entries.map((entry) => [valueText(entry["@_name"]), valueText(entry.value)]).filter(([key]) => key));
}

function pointCoordinates(placemark: XmlNode): string {
  const direct = placemark.Point as XmlNode | undefined;
  if (direct) return valueText(direct.coordinates);
  const multi = placemark.MultiGeometry as XmlNode | undefined;
  const point = asArray(multi?.Point as XmlNode | XmlNode[] | undefined)[0];
  return point ? valueText(point.coordinates) : "";
}

export function parseKmz(bytes: Uint8Array): KmzParseResult {
  const files = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith(".kml") });
  const kmlName = Object.keys(files).find((name) => name.toLowerCase().endsWith(".kml"));
  if (!kmlName) throw new Error("This KMZ does not contain a KML document.");
  if (files[kmlName].byteLength > 12 * 1024 * 1024) throw new Error("The expanded KML is too large to import safely.");

  const xml = new TextDecoder().decode(files[kmlName]);
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: false, parseTagValue: false, cdataPropName: "#cdata" });
  const parsed = parser.parse(xml) as XmlNode;
  const document = ((parsed.kml as XmlNode | undefined)?.Document ?? parsed.Document) as XmlNode | undefined;
  if (!document) throw new Error("The KML document could not be read.");

  const documentName = valueText(document.name) || kmlName;
  const locations: KmzLocation[] = [];
  let totalPlacemarks = 0;

  const visit = (container: XmlNode, folders: string[]) => {
    for (const placemark of asArray(container.Placemark as XmlNode | XmlNode[] | undefined)) {
      totalPlacemarks += 1;
      const coordinates = pointCoordinates(placemark).split(/\s+/).find(Boolean) || "";
      if (!coordinates) continue;
      const [longitude, latitude] = coordinates.split(",").map(Number);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 8 || latitude > 13 || longitude < 116 || longitude > 122) continue;

      const fields = dataFields(placemark);
      const name = valueText(placemark.name).slice(0, 180);
      if (!name) continue;
      const sourceFolder = folders.at(-1) || "";
      const barangay = barangayFromFolder(sourceFolder);
      const rawDescription = valueText(placemark.description) || fields.description || "";
      const description = cleanDescription(rawDescription);
      const warnings: string[] = [];
      if (barangay === "Unassigned") warnings.push("Barangay could not be identified from the KMZ folder.");
      if (!description) warnings.push("No usable public description was included.");
      warnings.push("Type was inferred and must be reviewed by an admin.");
      const sourceRecordId = fields.id || fields.ID || valueText(placemark["@_id"]);
      const type = inferType(name, description);
      locations.push({
        name, type, barangay, latitude, longitude, description, sourceRecordId, sourceFolder,
        sourceKeySeed: `${normalize(documentName)}|${normalize(sourceFolder)}|${normalize(name)}|${latitude.toFixed(6)}|${longitude.toFixed(6)}`,
        warnings,
      });
    }
    for (const folder of asArray(container.Folder as XmlNode | XmlNode[] | undefined)) {
      visit(folder, [...folders, valueText(folder.name)]);
    }
  };

  visit(document, []);
  return { documentName, totalPlacemarks, ignoredCount: totalPlacemarks - locations.length, locations };
}
