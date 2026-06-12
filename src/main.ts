import { Actor, log } from 'apify';
import type { ActorInput } from './types.js';
import { normalizeInput, pushAndCharge, scrapeUsedCars } from './routes.js';

await Actor.init();

try {
  const rawInput = (await Actor.getInput<ActorInput>()) ?? {};
  const input = normalizeInput(rawInput);
  const proxyConfiguration = rawInput.proxyConfiguration
    ? await Actor.createProxyConfiguration(rawInput.proxyConfiguration)
    : undefined;

  log.info('Starting India Used Cars Scraper', {
    source: input.source,
    cities: input.cities,
    models: input.models,
    maxResults: input.maxResults,
  });

  let saved = 0;
  for await (const record of scrapeUsedCars(input, proxyConfiguration)) {
    await pushAndCharge(record);
    saved += 1;
  }

  if (saved === 0) {
    log.warning('No used-car records matched the input. Try a broader city/model or disable price filters.');
  } else {
    log.info(`Finished. Saved ${saved} used-car records.`);
  }
} finally {
  await Actor.exit();
}
