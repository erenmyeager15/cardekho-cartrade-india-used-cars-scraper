# CarDekho & CarTrade India Used Cars Scraper - Prices, KM & Listings

Scrape Indian used-car listings from CarDekho and CarTrade and export clean vehicle data to JSON, CSV, Excel, or HTML, or pull it via the Apify API. This actor collects marketplace listings by city and car model, including price, model year, kilometres driven, fuel type, transmission, owner information when available, images, location, and listing URLs. No login or API key is required.

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

## Sample Output

```json
{
  "source": "cartrade",
  "searchQuery": "Honda City",
  "cityQuery": "Mumbai",
  "listingId": "e08g4e0j",
  "title": "2014 Honda City VX Diesel",
  "make": "Honda",
  "model": "City",
  "year": 2014,
  "price": 550000,
  "priceDisplay": "INR 5,50,000",
  "currency": "INR",
  "kmDriven": 110962,
  "fuelType": "Diesel",
  "transmission": "Manual",
  "bodyType": "Sedan",
  "owner": "First Owner",
  "color": "White",
  "listingBadge": "Sponsored",
  "city": "Mumbai",
  "state": "Maharashtra",
  "location": "Mulund (W), Mumbai",
  "address": "Mumbai, Maharashtra",
  "imageUrl": "https://imgd-ct.aeplcdn.com/640X480/vimages/example.jpg",
  "listingUrl": "https://www.cartrade.com/second-hand/mumbai/honda-city/e08g4e0j/",
  "sourceRank": 1,
  "scrapedAt": "2026-06-12T12:45:00.000Z"
}
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
