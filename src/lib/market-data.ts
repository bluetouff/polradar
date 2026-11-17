import rows from '../data/prediction-markets.json';
import { marketSnapshotSchema } from './markets.mjs';
export const predictionMarkets = marketSnapshotSchema.parse(rows);
export type MarketProvider = (typeof predictionMarkets.providers)[number];
export type MarketContract = MarketProvider['contracts'][number];
