import { Actor, log } from 'apify';
import { fetch, ProxyAgent } from 'undici';
import type { ActorInput, JsonLdCar, NormalizedInput, SearchJob, Source, UsedCarRecord } from './types.js';

export const CHARGE_EVENT_NAME = 'car-scraped';

const MAX_RESULTS = 500;
const MAX_FILTER_ITEMS = 10;
const MAX_SEARCH_JOBS = 40;
const CARDDEKHO_BASE_URL = 'https://www.cardekho.com';
const CARTRADE_BASE_URL = 'https://www.cartrade.com';
const BLOCKED_STATUS_CODES = new Set([401, 403, 407, 408, 409, 425, 429, 500, 502, 503, 504]);

type ProxyLike = {
  newUrl: () => Promise<string | undefined> | string | undefined;
};

interface FetchOptions {
  proxyConfiguration?: ProxyLike;
  retries?: number;
}

export function normalizeInput(input: ActorInput | null | undefined): NormalizedInput {
  const source = normalizeSource(input?.source);
  const sources = source === 'both' ? ['cardekho', 'cartrade'] as const : [source];
  const cities = uniqueStrings(input?.cities).slice(0, MAX_FILTER_ITEMS);
  const models = uniqueStrings(input?.models).slice(0, MAX_FILTER_ITEMS);
  const normalizedCities = cities.length ? cities : ['Mumbai'];
  const normalizedModels = models.length ? models : ['Honda City'];
  const minPrice = normalizePrice(input?.minPrice, 'Minimum price');
  const maxPrice = normalizePrice(input?.maxPrice, 'Maximum price');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new Error(`Minimum price (${minPrice}) cannot be greater than maximum price (${maxPrice}).`);
  }

  const searchJobCount = sources.length * normalizedCities.length * normalizedModels.length;
  if (searchJobCount > MAX_SEARCH_JOBS) {
    throw new Error(`Input creates ${searchJobCount} source/city/model searches; maximum is ${MAX_SEARCH_JOBS}.`);
  }

  return {
    source,
    sources: [...sources],
    cities: normalizedCities,
    models: normalizedModels,
    minPrice,
    maxPrice,
    maxResults: normalizeMaxResults(input?.maxResults),
  };
}

export async function* scrapeUsedCars(
  input: NormalizedInput,
  proxyConfiguration?: ProxyLike,
): AsyncGenerator<UsedCarRecord> {
  const jobs = createJobs(input);
  const seen = new Set<string>();
  let yielded = 0;

  while (yielded < input.maxResults && jobs.some((job) => !job.done || job.queue.length > 0)) {
    for (const job of jobs) {
      if (yielded >= input.maxResults) break;

      if (job.queue.length === 0 && !job.done) {
        job.queue = await fetchJobPage(job, proxyConfiguration);
      }

      while (job.queue.length > 0 && yielded < input.maxResults) {
        const record = job.queue.shift();
        if (!record) break;

        const dedupeKey = `${record.source}:${record.listingId || record.listingUrl}`;
        if (seen.has(dedupeKey)) continue;
        if (!passesPriceFilter(record, input.minPrice, input.maxPrice)) continue;

        seen.add(dedupeKey);
        yielded += 1;
        yield record;
        break;
      }
    }
  }
}

export async function pushAndCharge(record: UsedCarRecord) {
  // Push and charge atomically so records beyond the user's charge limit are
  // not saved for free and billing failures stop the run immediately.
  return Actor.pushData(record, CHARGE_EVENT_NAME);
}

function createJobs(input: NormalizedInput): SearchJob[] {
  const jobs: SearchJob[] = [];

  for (const source of input.sources) {
    for (const city of input.cities) {
      for (const model of input.models) {
        jobs.push({
          source,
          city,
          model,
          page: 1,
          maxPages: source === 'cardekho' ? 1 : Math.ceil(input.maxResults / 20) + 2,
          done: false,
          queue: [],
        });
      }
    }
  }

  return jobs;
}

async function fetchJobPage(job: SearchJob, proxyConfiguration?: ProxyLike): Promise<UsedCarRecord[]> {
  const url = buildUrl(job);

  log.info('Fetching used-car listings', {
    source: job.source,
    city: job.city,
    model: job.model,
    page: job.page,
  });

  let records: UsedCarRecord[] = [];
  try {
    const html = await fetchHtml(url, { proxyConfiguration });
    records = parseListings(job, html);
  } catch (error) {
    log.warning('Skipping used-car page after retries failed', {
      source: job.source,
      city: job.city,
      model: job.model,
      page: job.page,
      error: error instanceof Error ? error.message : String(error),
    });
    job.done = true;
    return [];
  }

  job.page += 1;
  if (job.page > job.maxPages || records.length === 0) {
    job.done = true;
  }

  await sleep(randomInt(800, 1800));
  return records;
}

function buildUrl(job: SearchJob): string {
  if (job.source === 'cardekho') {
    const citySlug = slugifyCity(job.city, 'cardekho');
    const modelSlug = slugifyModel(job.model, 'cardekho');
    const path = modelSlug ? `/used-${modelSlug}+cars+in+${citySlug}` : `/used-cars+in+${citySlug}`;
    return `${CARDDEKHO_BASE_URL}${path}${job.page > 1 ? `/page-${job.page}` : ''}`;
  }

  const citySlug = slugifyCity(job.city, 'cartrade');
  const modelSlug = slugifyModel(job.model, 'cartrade');
  const basePath = modelSlug ? `/second-hand/${citySlug}/${modelSlug}/` : `/second-hand/${citySlug}/`;
  return `${CARTRADE_BASE_URL}${basePath}${job.page > 1 ? `page-${job.page}/` : ''}`;
}

async function fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
  const retries = options.retries ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const proxyUrl = options.proxyConfiguration ? await options.proxyConfiguration.newUrl() : undefined;
      const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-IN,en;q=0.9',
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
        dispatcher,
        signal: AbortSignal.timeout(60_000),
      });

      if (BLOCKED_STATUS_CODES.has(response.status)) {
        throw new Error(`Source returned retryable status ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`Source request failed with ${response.status}`);
      }

      const html = await response.text();
      const hasListingMarkers = /application\/ld\+json|used-car-card|itemListElement|carlistblk/i.test(html);
      if (!hasListingMarkers && /captcha|access denied|cloudflare|verify you are human/i.test(html)) {
        throw new Error('Blocked or challenge page returned by source');
      }
      return html;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(800 * attempt + randomInt(300, 1200));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseListings(job: SearchJob, html: string): UsedCarRecord[] {
  const jsonLdRecords = parseJsonLdCars(html).map((car) => normalizeJsonLdCar(job, car));
  if (job.source === 'cardekho') return jsonLdRecords.filter(isUsefulRecord);

  const cardRecords = parseCarTradeCards(job, html);
  const records = jsonLdRecords.length ? jsonLdRecords : cardRecords;
  return records.filter(isUsefulRecord);
}

function parseJsonLdCars(html: string): JsonLdCar[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const cars: JsonLdCar[] = [];

  for (const script of scripts) {
    const jsonText = extractBalancedJson(script[1]);
    if (!jsonText) continue;

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const graphs = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];

      for (const graph of graphs) {
        if (!graph || typeof graph !== 'object') continue;
        const itemListElement = (graph as Record<string, unknown>).itemListElement;
        if (!Array.isArray(itemListElement)) continue;

        for (const item of itemListElement) {
          const candidate =
            item && typeof item === 'object' && 'item' in item
              ? (item as Record<string, unknown>).item
              : item;
          if (candidate && typeof candidate === 'object' && (candidate as JsonLdCar)['@type'] === 'Car') {
            cars.push(candidate as JsonLdCar);
          }
        }
      }
    } catch {
      // Skip malformed structured data blocks; both sources sometimes append non-JSON content.
    }
  }

  return cars;
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function normalizeJsonLdCar(job: SearchJob, car: JsonLdCar): UsedCarRecord {
  const brand = valueFromBrand(car.brand ?? car.Brand);
  const year = toInteger(car.vehicleModelDate ?? car.modelDate);
  const price = toInteger(car.offers?.price);
  const address = car.location?.address;
  const url = absoluteUrl(job.source, car.url ?? '');
  const title = cleanTitle(car.alternateName ?? car.alternatename ?? car.name ?? '', job.source);
  const listingId = extractListingId(url) ?? cleanOptionalString(car.vehicleIdentificationNumber) ?? `${job.source}-${hashText(url || title)}`;

  return {
    source: job.source,
    searchQuery: job.model || 'all cars',
    cityQuery: job.city,
    listingId,
    title,
    make: brand,
    model: cleanOptionalString(car.model),
    year,
    price,
    priceDisplay: price ? `INR ${formatIndianNumber(price)}` : null,
    currency: cleanOptionalString(car.offers?.priceCurrency) ?? 'INR',
    kmDriven: toInteger(car.mileageFromOdometer?.value),
    fuelType: cleanOptionalString(car.fuelType ?? car.vehicleEngine?.fuelType),
    transmission: cleanOptionalString(car.vehicleTransmission),
    bodyType: normalizeBodyType(car.bodyType),
    owner: cleanOptionalString(car.numberOfPreviousOwners ?? car.numberOfPreviousOwner),
    color: cleanOptionalString(car.color),
    listingBadge: null,
    city: cleanOptionalString(address?.addressLocality) ?? cityFromTitle(title) ?? job.city,
    state: cleanOptionalString(address?.addressRegion),
    location: cleanOptionalString(address?.addressLocality) ?? job.city,
    imageUrl: firstImageUrl(car.image),
    listingUrl: url,
    sourceRank: toInteger(car.position),
    scrapedAt: new Date().toISOString(),
  };
}

function parseCarTradeCards(job: SearchJob, html: string): UsedCarRecord[] {
  const records: UsedCarRecord[] = [];
  const cardRegex = /<li\b[^>]*data-testing-id=["']used-car-card-\d+["'][\s\S]*?<\/li>/gi;

  for (const match of html.matchAll(cardRegex)) {
    const card = match[0];
    const text = stripHtml(card);
    const href = decodeHtml(
      matchAttr(card, 'data-tiny') ??
        card.match(/openDetailsPage\(&quot;([^&]+)&quot;\)/i)?.[1] ??
        card.match(/href=["']([^"']+)["']/i)?.[1] ??
        '',
    );
    const url = absoluteUrl('cartrade', href);
    const label = matchAttr(card, 'data-label') ?? '';
    const stockId = label.match(/stockId=([^|"]+)/)?.[1] ?? matchAttr(card, 'data-stockid') ?? extractListingId(url);
	    const title =
	      decodeHtml(card.match(/title=["']Buy Used ([^"']+)["']/i)?.[1] ?? '') ||
	      decodeHtml(card.match(/alt=["']Used ([^"']+)["']/i)?.[1] ?? '') ||
	      (text.match(/\b(20\d{2}|19\d{2})\s+(.+?)\s+(?:\u20B9|INR|Rs\.?)/i)?.[0] ??
	        '');
    const priceDisplay = extractPriceDisplay(text);
    const location = extractCardLocation(text);
    const rank = toInteger(card.match(/used-car-card-(\d+)/i)?.[1]);

    records.push({
      source: 'cartrade',
      searchQuery: job.model || 'all cars',
      cityQuery: job.city,
      listingId: stockId ?? `${hashText(url || title)}`,
      title: cleanTitle(title, 'cartrade'),
      make: matchAttr(card, 'data-share-make') ?? firstTokenAfterYear(title),
      model: matchAttr(card, 'data-share-model'),
      year: toInteger(matchAttr(card, 'data-share-mfgyear') ?? text.match(/\b(20\d{2}|19\d{2})\b/)?.[1]),
      price: parseIndianPrice(priceDisplay),
      priceDisplay,
      currency: 'INR',
      kmDriven: toInteger(text.match(/([\d,]+)\s*KMs?/i)?.[1]?.replace(/,/g, '')),
      fuelType: cleanOptionalString(text.match(/KMs?\s*\|\s*([^|]+?)\s*\|/i)?.[1]),
      transmission: null,
      bodyType: null,
      owner: null,
      color: null,
      listingBadge: extractBadge(text),
      city: job.city,
      state: null,
      location,
      imageUrl: decodeHtml(card.match(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']Used/i)?.[1] ?? card.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? '') || null,
      listingUrl: url,
      sourceRank: rank === null ? null : rank + 1,
      scrapedAt: new Date().toISOString(),
    });
  }

  return records;
}

export function passesPriceFilter(record: UsedCarRecord, minPrice?: number, maxPrice?: number): boolean {
  if (record.price === null) return minPrice === undefined && maxPrice === undefined;
  if (minPrice !== undefined && record.price < minPrice) return false;
  if (maxPrice !== undefined && record.price > maxPrice) return false;
  return true;
}

function isUsefulRecord(record: UsedCarRecord): boolean {
  return Boolean(record.listingId && record.title && record.listingUrl);
}

function normalizeSource(value: unknown): NormalizedInput['source'] {
  return value === 'cardekho' || value === 'cartrade' || value === 'both' ? value : 'cardekho';
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)));
}

function normalizePrice(value: unknown, label: string): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative INR amount.`);
  }
  return number;
}

function normalizeMaxResults(value: unknown): number {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(MAX_RESULTS, Math.floor(number)));
}

function slugifyCity(city: string, source: Source): string {
  const normalized = city.trim().toLowerCase();
  const aliases: Record<string, { cardekho: string; cartrade: string }> = {
    delhi: { cardekho: 'delhi-ncr', cartrade: 'delhi' },
    'delhi ncr': { cardekho: 'delhi-ncr', cartrade: 'delhi' },
    bengaluru: { cardekho: 'bangalore', cartrade: 'bangalore' },
    bangalore: { cardekho: 'bangalore', cartrade: 'bangalore' },
    'navi mumbai': { cardekho: 'navi-mumbai', cartrade: 'navi-mumbai' },
  };
  return aliases[normalized]?.[source] ?? slugify(normalized);
}

function slugifyModel(model: string, source: Source): string {
  if (!model.trim() || /^all(?: cars)?$/i.test(model)) return '';
  let normalized = model.trim().toLowerCase();
  if (source === 'cardekho') normalized = normalized.replace(/^maruti\s+suzuki\b/, 'maruti');
  return slugify(normalized);
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function absoluteUrl(source: Source, url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${source === 'cardekho' ? CARDDEKHO_BASE_URL : CARTRADE_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

function extractListingId(url: string): string | null {
  if (!url) return null;
  const stock = url.match(/\/([a-z0-9]{6,12})\/(?:\?|$)/i)?.[1];
  if (stock) return stock;
  const cardekho = url.match(/_([a-f0-9-]{16,})\.htm/i)?.[1];
  if (cardekho) return cardekho;
  return null;
}

function firstImageUrl(image: JsonLdCar['image']): string | null {
  if (!image) return null;
  const first = Array.isArray(image) ? image[0] : image;
  if (typeof first === 'string') return first;
  return first.url ?? first.contentUrl ?? null;
}

function valueFromBrand(brand: JsonLdCar['brand'] | JsonLdCar['Brand']): string | null {
  if (!brand) return null;
  if (typeof brand === 'string') return cleanOptionalString(brand);
  return cleanOptionalString(brand.name);
}

function cleanTitle(title: string, source: Source): string {
  const cleaned = decodeHtml(title)
    .replace(/\bSecond Hand\b/gi, 'Used')
    .replace(/^(\d{4})\s+Used\s+/i, '$1 ')
    .replace(/\s+in\s+[A-Za-z -]+$/i, '')
    .replace(/^Used\s+/i, '')
    .trim();
  return cleaned;
}

function cityFromTitle(title: string): string | null {
  return cleanOptionalString(title.match(/\bin\s+([A-Za-z -]+)$/i)?.[1]);
}

function normalizeBodyType(value: unknown): string | null {
  const text = cleanOptionalString(value);
  if (!text) return null;
  return text.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function matchAttr(html: string, name: string): string | null {
  const match = html.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? decodeHtml(match[2]) : null;
}

function stripHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPriceDisplay(text: string): string | null {
  return cleanOptionalString(text.match(/(?:\u20B9|Rs\.?|INR)\s*[\d,.]+(?:\s*(?:Lakh|Crore))?/i)?.[0]);
}

export function parseIndianPrice(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d[\d,.]*)\s*(lakh|crore)?/i);
  if (!match) return null;
  const numeric = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  const unit = match[2]?.toLowerCase();
  if (unit === 'lakh') return Math.round(numeric * 100_000);
  if (unit === 'crore') return Math.round(numeric * 10_000_000);
  return Math.round(numeric);
}

function extractCardLocation(text: string): string | null {
  return cleanOptionalString(text.match(/KMs?\s*\|\s*[^|]+\|\s*([^|]+?)\s*(?:CONTACT SELLER|$)/i)?.[1]);
}

function extractBadge(text: string): string | null {
  for (const badge of ['Sponsored', 'Featured', 'Certified', 'Partner', 'Direct Owner']) {
    if (new RegExp(`\\b${badge}\\b`, 'i').test(text)) return badge;
  }
  return null;
}

function firstTokenAfterYear(title: string): string | null {
  return cleanOptionalString(title.replace(/^(?:Used\s+)?(?:19|20)\d{2}\s+/i, '').split(/\s+/)[0]);
}

function toInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? Math.round(number) : null;
}

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return text || null;
}

function formatIndianNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
