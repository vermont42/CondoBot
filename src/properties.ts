interface Property {
  slug: string;
  area: string;
  name: string;
  supported: boolean;
}

const BANYAN_TREE: Property = {
  slug: "banyan-tree-300",
  area: "kailua-kona",
  name: "Banyan Tree 300",
  supported: true,
};

const properties: Record<string, Property> = {
  // Exact match for Airbnb listing name
  "Gorgeous Unit, Stunning Views!": BANYAN_TREE,
  // Substring match for VRBO listing name
  "banyan tree": BANYAN_TREE,
};

const DEFAULT_PROPERTY: Property = {
  slug: "unknown",
  area: "unknown",
  name: "Unknown",
  supported: false,
};

export function getAreaForSlug(slug: string): string {
  for (const prop of Object.values(properties)) {
    if (prop.slug === slug) return prop.area;
  }
  return DEFAULT_PROPERTY.area;
}

export function resolveProperty(listingName: string): Property {
  // Try exact match first, then case-insensitive substring match
  if (properties[listingName]) return properties[listingName];

  const lower = listingName.toLowerCase();
  for (const [key, prop] of Object.entries(properties)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return prop;
    }
  }

  return DEFAULT_PROPERTY;
}
