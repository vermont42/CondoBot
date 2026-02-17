interface Property {
  slug: string;
  area: string;
  name: string;
}

const properties: Record<string, Property> = {
  // Map Hospitable property names/IDs to our knowledge base slugs.
  // For MVP, everything defaults to banyan-tree-300.
};

const DEFAULT_PROPERTY: Property = {
  slug: "banyan-tree-300",
  area: "kailua-kona",
  name: "Banyan Tree 300",
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
