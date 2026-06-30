import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInput, parseIndianPrice } from './routes.js';

test('uses a one-result CarDekho direct-request default', () => {
  const input = normalizeInput(null);

  assert.equal(input.source, 'cardekho');
  assert.deepEqual(input.sources, ['cardekho']);
  assert.deepEqual(input.cities, ['Mumbai']);
  assert.deepEqual(input.models, ['Honda City']);
  assert.equal(input.maxResults, 1);
});

test('cleans filters and clamps the result limit', () => {
  const input = normalizeInput({
    source: 'both',
    cities: [' Mumbai ', '', 'Mumbai', ' Delhi  NCR '],
    models: [' Honda City ', 'Honda City'],
    minPrice: 300_000,
    maxPrice: 900_000,
    maxResults: 900,
  });

  assert.deepEqual(input.cities, ['Mumbai', 'Delhi NCR']);
  assert.deepEqual(input.models, ['Honda City']);
  assert.equal(input.maxResults, 500);
  assert.equal(input.minPrice, 300_000);
  assert.equal(input.maxPrice, 900_000);
});

test('rejects invalid price ranges and excessive search combinations', () => {
  assert.throws(
    () => normalizeInput({ minPrice: 900_000, maxPrice: 300_000 }),
    /cannot be greater/,
  );
  assert.throws(
    () => normalizeInput({
      source: 'both',
      cities: Array.from({ length: 10 }, (_, index) => `city-${index}`),
      models: Array.from({ length: 10 }, (_, index) => `model-${index}`),
    }),
    /maximum is 40/,
  );
});

test('parses lakh, crore, and plain INR prices', () => {
  assert.equal(parseIndianPrice('INR 4.25 Lakh'), 425_000);
  assert.equal(parseIndianPrice('Rs. 1.2 Crore'), 12_000_000);
  assert.equal(parseIndianPrice('INR 650,000'), 650_000);
  assert.equal(parseIndianPrice(null), null);
});
