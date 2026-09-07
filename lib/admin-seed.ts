import { categories, communities, opportunities } from "./sanvic-data";

export const copySeed = [
  ["home.eyebrow", "Home", "Eyebrow", "The soul of San Vicente"],
  ["home.heading", "Home", "Hero heading", "Slow down.\nTune in.\nYou’re in\nSan Vicente."],
  ["home.body", "Home", "Editorial introduction", "Some places ask you to do more.\nSan Vicente asks you to do less.\nWake slowly. Swim longer.\nEat what arrived this morning.\nLearn the names of fishermen.\nStay long enough to discover your own favorite beach.\nAnd perhaps leave carrying fewer plans than when you arrived."],
  ["home.endnote", "Home", "End note", "10 communities. Hundreds of stories.\nOne coastline waiting to be explored."],
  ["home.travelers", "Home", "Nearby traveler label", "41 Travelers Nearby"],
  ["explore.eyebrow", "Explore", "Eyebrow", "Municipality Explorer"],
  ["explore.heading", "Explore", "Heading", "A coast.\nTen communities."],
  ["explore.description", "Explore", "Description", "Find your corner of San Vicente."],
  ["discover.eyebrow", "Discover", "Eyebrow", "A little curiosity goes a long way"],
  ["discover.heading", "Discover", "Heading", "Follow what moves you."],
  ["discover.description", "Discover", "Description", "No checklist. Just possibilities."],
  ["travelers.eyebrow", "Travelers", "Eyebrow", "Around San Vicente"],
  ["travelers.heading", "Travelers", "Heading", "Travelers Nearby"],
  ["travelers.description", "Travelers", "Description", "A shared boat. A spare seat. A new friend."],
  ["journey.eyebrow", "Journey", "Eyebrow", "Collect moments. Track your story."],
  ["journey.heading", "Journey", "Heading", "Your island journey."],
  ["journey.description", "Journey", "Description", "A little more connected with every day."],
] as const;

export const itemSeed = [
  ...communities.map((item, index) => ({ id: `community-${item.id}`, kind: "community", slug: item.id, title: item.name, data: item, sortOrder: index })),
  ...categories.map((item, index) => ({ id: `category-${item.id}`, kind: "category", slug: item.id, title: item.title, data: item, sortOrder: index })),
  ...opportunities.map((item, index) => ({ id: `opportunity-${item.id}`, kind: "opportunity", slug: item.id, title: item.title, data: item, sortOrder: index })),
  ...[
    { id: "first-connection", name: "First Connection", description: "Join your first plan", rule: "joined", threshold: 1 },
    { id: "island-hopper", name: "Island Hopper", description: "Join an island-hopping plan", rule: "opportunity", threshold: 1 },
    { id: "sunset-chaser", name: "Sunset Chaser", description: "Join a sunset plan", rule: "opportunity", threshold: 1 },
    { id: "barangay-collector", name: "Barangay Collector", description: "Visit your first community", rule: "visited", threshold: 1 },
    { id: "pathfinder", name: "Pathfinder", description: "Visit five communities", rule: "visited", threshold: 5 },
    { id: "sanvic-ambassador", name: "SanVic Ambassador", description: "Visit all ten communities", rule: "visited", threshold: 10 },
  ].map((item, index) => ({ id: `badge-${item.id}`, kind: "badge", slug: item.id, title: item.name, data: item, sortOrder: index })),
];

export const baiaSeed = {
  id: "place-baia",
  name: "BAIA",
  type: "Accommodation",
  barangay: "Poblacion",
  googleMapsUrl: "https://maps.google.com/?cid=10200203730032398615",
  googlePlaceId: "",
  sourceLatitude: 10.5311,
  sourceLongitude: 119.3412,
  displayLatitude: 10.5311,
  displayLongitude: 119.3412,
  address: "Poblacion, San Vicente, Palawan",
  phone: "",
  website: "",
  description: "A place to stay in Poblacion, San Vicente.",
  bookingUrl: "",
  coverMediaId: "",
  photoIds: [] as string[],
  status: "published",
  featured: true,
  verified: true,
  sortOrder: 0,
};

