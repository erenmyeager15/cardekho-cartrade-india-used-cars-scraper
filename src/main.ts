import { Actor, log } from 'apify';
import { wasPushedRecordSaved } from './billing.js';
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
  let spendingLimitReached = false;
  for await (const record of scrapeUsedCars(input, proxyConfiguration)) {
    const chargingResult = await pushAndCharge(record);
    const recordWasSaved = wasPushedRecordSaved(chargingResult);
    if (recordWasSaved) {
      saved += 1;
    }

    if (chargingResult.eventChargeLimitReached) {
      spendingLimitReached = true;
      await Actor.setStatusMessage(`Stopped at the user's spending limit after ${saved} cars`);
      log.warning('User spending limit reached; stopping before more CarDekho or CarTrade requests.');
      break;
    }
  }

  if (saved === 0 && !spendingLimitReached) {
    throw new Error('No used-car records were saved. Try one city, one model, no price filters, or enable Apify Proxy.');
  }
  log.info(`Finished. Saved ${saved} used-car records.`);
} catch (error) {
  log.exception(error as Error, 'Used-car Actor failed');
  throw error;
} finally {
  await Actor.exit();
}
