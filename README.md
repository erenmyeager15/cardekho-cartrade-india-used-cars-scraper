# CarDekho & CarTrade India Used Cars Scraper - Prices, KM & Listings

The CarDekho and CarTrade used cars scraper extracts public Indian used-car listings by city and car model. Export to JSON, CSV, Excel, or HTML, or pull via the Apify API. No source-site login or API key is required.

This scraper collects price, model year, kilometres driven, fuel type, transmission, ownership history, images, location, and listing URLs into one clean dataset. Built with Node.js 20, TypeScript, and native fetch, it parses each site's structured listing data with retries and optional Apify residential proxies so runs stay reliable and repeatable.

For the first run, select `cardekho`, `Mumbai`, `Honda City`, leave price filters empty, set `maxResults` to `1`, and keep proxy off. Inspect that record, then add CarTrade, more searches, or price filters.

This independent Actor collects listing facts only. It does not collect phone numbers, emails, gated seller contacts, accounts, messages, saved cars, or private dashboard data.

## What It Extracts

- Source: CarDekho or CarTrade
- Search model and city query
- Listing ID, car title, make, model, and year
- Price, formatted price, and currency
- Kilometres driven
- Fuel type and transmission
- Body type, owner count, and color when available
- Badge such as Certified, Featured, Sponsored, Partner, or Direct Owner when available
- City, state, and location when available
- Main image URL
- Public listing URL
- Scraped timestamp

## Use Cases

- Used-car price monitoring across Indian cities
- Dealer inventory research for auto marketplaces and dealerships
- Market research for car finance, insurance, and inspection services
- Competitive intelligence for popular models such as Honda City, Swift, Creta, Fortuner, and Innova
- Market analytics for listing-price bands, mileage, fuel type, and city-level supply

## Pricing

| Event | Price | 1,000 cars | 10,000 cars |
| --- | ---: | ---: | ---: |
| `apify-actor-start` | `$0.00005 / GB` | - | - |
| `car-scraped` | `$0.003` per car | `$3.00` | `$30.00` |

Each clean used-car record is saved and charged atomically. Failed, blocked, or empty pages do not create `car-scraped` charges, but the startup event and platform resource consumption can still apply. The Actor stops before further source requests when the user's spending limit is reached.

Cost-control tips:

- Start with CarDekho, one city, one model, and `maxResults: 1`.
- Leave price filters empty for the first run.
- Keep proxy off while direct requests are working; enable it only if source access becomes unreliable.
- Set a maximum cost per run in Apify Console before scaling.
- Use `both` only after checking a one-source result.

## Input

| Field | Type | Description |
| --- | --- | --- |
| `source` | string | `both`, `cardekho`, or `cartrade`. Default: `cardekho`. |
| `cities` | string array | Cities such as `Mumbai`, `Delhi NCR`, `Bangalore`, `Hyderabad`, `Chennai`, or `Pune`. |
| `models` | string array | Car make/model searches such as `Honda City`, `Maruti Swift`, `Toyota Fortuner`, or `All Cars`. |
| `minPrice` | integer | Optional minimum listing price in INR. |
| `maxPrice` | integer | Optional maximum listing price in INR. |
| `maxResults` | integer | Number of unique used-car listings to save, up to 500. Default: `1`. |
| `proxyConfiguration` | object | Optional Apify Proxy settings. Direct requests are the default. |

## How to Scrape Used Cars in India (Step by Step)

1. Choose `cardekho` for the smallest first run.
2. Enter one city, such as `Mumbai`.
3. Enter one model, such as `Honda City`.
4. Leave price filters empty, set `maxResults` to `1`, and keep proxy off.
5. Run the Actor and check the dataset.
6. Add CarTrade, cities, models, or price filters only after the first result looks correct.

## Example Input

```json
{
  "source": "cardekho",
  "cities": ["Mumbai"],
  "models": ["Honda City"],
  "maxResults": 1,
  "proxyConfiguration": { "useApifyProxy": false }
}
```

### Multi-city, price-filtered search

```json
{
  "source": "cartrade",
  "cities": ["Delhi NCR", "Bangalore"],
  "models": ["Maruti Swift", "Hyundai Creta"],
  "minPrice": 300000,
  "maxPrice": 900000,
  "maxResults": 20,
  "proxyConfiguration": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
}
```

## Output dataset

```json
{
  "source": "cardekho",
  "searchQuery": "Honda City",
  "cityQuery": "Mumbai",
  "listingId": "3268e027-6ac0-45ac-87ce-15b2e1eddcfd",
  "title": "2015 Honda City",
  "make": "Honda",
  "model": "City 2014-2015",
  "year": 2015,
  "price": 395000,
  "priceDisplay": "INR 3,95,000",
  "currency": "INR",
  "kmDriven": 51000,
  "fuelType": "Petrol",
  "transmission": "Automatic",
  "bodyType": "Sedan",
  "owner": "First-Owner",
  "color": "Brown",
  "listingBadge": null,
  "city": "Mumbai",
  "state": null,
  "location": "Mumbai",
  "imageUrl": "https://images10.gaadi.com/usedcar_image/5332642/original/processed_97105be4-e06b-46c2-a673-2716292d46a3.jpg",
  "listingUrl": "https://www.cardekho.com/used-car-details/used-Honda-city-i-vtec-cvt-sv-cars-Mumbai_3268e027-6ac0-45ac-87ce-15b2e1eddcfd.htm",
  "sourceRank": null,
  "scrapedAt": "2026-06-12T19:56:21.039Z"
}
```

## API Example

```bash
curl -X POST "https://api.apify.com/v2/acts/fascinating_lentil~cardekho-cartrade-india-used-cars-scraper/runs?token=YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"cardekho","cities":["Mumbai"],"models":["Honda City"],"maxResults":1,"proxyConfiguration":{"useApifyProxy":false}}'
```

```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });
const run = await client.actor('fascinating_lentil/cardekho-cartrade-india-used-cars-scraper').call({
  source: 'cardekho',
  cities: ['Mumbai'],
  models: ['Honda City'],
  maxResults: 1,
  proxyConfiguration: { useApifyProxy: false },
});
const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(`Got ${items.length} used-car listings`);
```

## How It Works

The actor fetches public used-car listing pages from CarDekho and CarTrade, parses structured listing data and listing-card markup, normalizes fields into one dataset, deduplicates by source and listing ID, applies optional price filters, and atomically saves and charges each accepted record.

## Known Limits

- The actor does not expose phone numbers, email addresses, or gated seller contact details.
- CarDekho's public structured listing data can repeat across paginated pages, so CarDekho extraction uses the reliable structured listing page per city/model search. CarTrade supports deeper page pagination.
- Some fields are source-dependent. For example, CarTrade card pages may not expose transmission or owner on every result.
- Source websites may change their public markup or restrict traffic. Use Apify Proxy if larger runs become less reliable.
- Listing availability and prices can change after scraping; verify important decisions against the source page.
- This Actor is not affiliated with CarDekho or CarTrade.

## Responsible Use

This Actor is intended for lawful collection of publicly available information only. Users are responsible for ensuring their use complies with the source website's terms, robots.txt, applicable privacy laws, including India's DPDP Act, and all local regulations.

Do not use this Actor for seller, dealer, buyer, or owner lead generation, or to collect, store, sell, or misuse personal data. The Actor author is not responsible for misuse by end users.

## License

Apache-2.0
