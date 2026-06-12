# CarDekho & CarTrade India Used Cars Scraper - Prices, KM & Listings

The CarDekho and CarTrade used cars scraper extracts real Indian used-car listings by city and car model from both marketplaces. Export to JSON, CSV, Excel, or HTML, or pull via the Apify API — no login and no API key required.

This scraper collects price, model year, kilometres driven, fuel type, transmission, owner information, images, location, and listing URLs into one clean dataset. Built with Node.js 20, TypeScript, and native fetch, it parses each site's structured listing data with retries and optional Apify residential proxies so runs stay reliable and repeatable.

## What It Extracts

- Source: CarDekho or CarTrade
- Search model and city query
- Listing ID, car title, make, model, and year
- Price, formatted price, and currency
- Kilometres driven
- Fuel type and transmission
- Body type, owner count, and color when available
- Badge such as Certified, Featured, Sponsored, Partner, or Direct Owner when available
- City, state, location, and address when available
- Main image URL
- Public listing URL
- Scraped timestamp

## Use Cases

- Used-car price monitoring across Indian cities
- Dealer inventory research for auto marketplaces and dealerships
- Lead generation for car finance, insurance, and inspection services
- Competitive intelligence for popular models such as Honda City, Swift, Creta, Fortuner, and Innova
- Market analytics for resale values, mileage bands, fuel type demand, and city-level supply

## Pricing

| Event | Price | 1,000 cars | 10,000 cars |
| --- | ---: | ---: | ---: |
| `car-scraped` | `$0.003` per car | `$3.00` | `$30.00` |

You are charged only after a clean used-car record is saved to the dataset.

## Input

| Field | Type | Description |
| --- | --- | --- |
| `source` | string | `both`, `cardekho`, or `cartrade`. |
| `cities` | string array | Cities such as `Mumbai`, `Delhi NCR`, `Bangalore`, `Hyderabad`, `Chennai`, or `Pune`. |
| `models` | string array | Car make/model searches such as `Honda City`, `Maruti Swift`, `Toyota Fortuner`, or `All Cars`. |
| `minPrice` | integer | Optional minimum listing price in INR. |
| `maxPrice` | integer | Optional maximum listing price in INR. |
| `maxResults` | integer | Number of unique used-car listings to save, up to 500. |
| `proxyConfiguration` | object | Optional Apify Proxy settings. |

## How to Scrape Used Cars in India (Step by Step)

1. Choose `both`, `cardekho`, or `cartrade`.
2. Enter one or more cities, such as `Mumbai` and `Delhi NCR`.
3. Enter one or more models, such as `Honda City` or `Toyota Fortuner`.
4. Optionally set a price range and result limit.
5. Run the actor and export the dataset or connect through the Apify API.

## Example Input

```json
{
  "source": "both",
  "cities": ["Mumbai"],
  "models": ["Honda City"],
  "maxResults": 50
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
  "maxResults": 200,
  "proxyConfiguration": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
}
```

## Sample Output

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
  "address": null,
  "imageUrl": "https://images10.gaadi.com/usedcar_image/5332642/original/processed_97105be4-e06b-46c2-a673-2716292d46a3.jpg",
  "listingUrl": "https://www.cardekho.com/used-car-details/used-Honda-city-i-vtec-cvt-sv-cars-Mumbai_3268e027-6ac0-45ac-87ce-15b2e1eddcfd.htm",
  "sourceRank": null,
  "scrapedAt": "2026-06-12T19:56:21.039Z"
}
```

## API Example

```bash
curl -X POST "https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs?token=YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"both","cities":["Mumbai"],"models":["Honda City"],"maxResults":50}'
```

```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });
const run = await client.actor('YOUR_ACTOR_ID').call({
  source: 'both',
  cities: ['Mumbai'],
  models: ['Honda City'],
  maxResults: 50,
});
const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(`Got ${items.length} used-car listings`);
```

## How It Works

The actor fetches public used-car listing pages from CarDekho and CarTrade, parses structured listing data and listing-card markup, normalizes fields into one dataset, deduplicates by source and listing ID, applies optional price filters, and charges only after a record is saved.

## Known Limits

- The actor does not expose phone numbers, email addresses, or gated seller contact details.
- CarDekho's public structured listing data can repeat across paginated pages, so CarDekho extraction uses the reliable structured listing page per city/model search. CarTrade supports deeper page pagination.
- Some fields are source-dependent. For example, CarTrade card pages may not expose transmission or owner on every result.
- Source websites may change their public markup or restrict traffic. Use Apify Proxy if larger runs become less reliable.
- This actor is not affiliated with CarDekho or CarTrade.

## License

Apache-2.0
