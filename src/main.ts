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
    const chargingResult = await pushAndCharge(record);
    const recordWasSaved = chargingResult.chargedCount > 0
      || !chargingResult.eventChargeLimitReached;
    if (recordWasSaved) {
      saved += 1;
    }

    if (chargingResult.eventChargeLimitReached) {
      await Actor.setStatusMessage(`Stopped at the user's spending limit after ${saved} cars`);
      log.warning('User spending limit reached; stopping before more CarDekho or CarTrade requests.');
      break;
    }
  }

  if (saved === 0) {
    log.warning('No used-car records matched the input. Try a broader city/model or disable price filters.');
  } else {
    log.info(`Finished. Saved ${saved} used-car records.`);
  }
} finally {
  await Actor.exit();
}
