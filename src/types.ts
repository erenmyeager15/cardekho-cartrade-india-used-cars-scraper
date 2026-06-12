export type Source = 'cardekho' | 'cartrade';
export type SourceInput = Source | 'both';

export interface ActorInput {
  source?: SourceInput;
  cities?: string[];
  models?: string[];
  minPrice?: number;
  maxPrice?: number;
  maxResults?: number;
  proxyConfiguration?: Record<string, unknown>;
}

export interface NormalizedInput {
  source: SourceInput;
  sources: Source[];
  cities: string[];
  models: string[];
  minPrice?: number;
  maxPrice?: number;
  maxResults: number;
}

export interface UsedCarRecord {
  source: Source;
  searchQuery: string;
  cityQuery: string;
  listingId: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  priceDisplay: string | null;
  currency: string | null;
  kmDriven: number | null;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  owner: string | null;
  color: string | null;
  listingBadge: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  address: string | null;
  imageUrl: string | null;
  listingUrl: string;
  sourceRank: number | null;
  scrapedAt: string;
}

export interface JsonLdCar {
  '@type'?: string;
  name?: string;
  alternateName?: string;
  alternatename?: string;
  model?: string;
  modelDate?: string | number;
  vehicleModelDate?: string | number;
  vehicleIdentificationNumber?: string;
  url?: string;
  description?: string;
  disambiguatingDescription?: string;
  image?: string | Array<string | { url?: string; contentUrl?: string }>;
  brand?: { name?: string } | string;
  Brand?: { name?: string } | string;
  fuelType?: string;
  vehicleEngine?: { fuelType?: string };
  vehicleTransmission?: string;
  bodyType?: string;
  numberOfPreviousOwners?: string;
  numberOfPreviousOwner?: string;
  color?: string;
  position?: number;
  mileageFromOdometer?: {
    value?: number | string;
    unitCode?: string;
  };
  offers?: {
    price?: number | string;
    priceCurrency?: string;
  };
  location?: {
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
    };
  };
}

export interface SearchJob {
  source: Source;
  city: string;
  model: string;
  page: number;
  maxPages: number;
  done: boolean;
  queue: UsedCarRecord[];
}
