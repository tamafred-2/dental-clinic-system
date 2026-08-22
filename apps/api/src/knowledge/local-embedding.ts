import {
  LOCAL_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_MODEL,
} from './knowledge.constants';
import type {
  KnowledgeEmbeddingBatch,
  KnowledgeEmbeddingProvider,
} from './knowledge.types';

const synonyms: Record<string, string> = {
  booking: 'appointment',
  book: 'appointment',
  reserve: 'appointment',
  cancellation: 'cancel',
  cancelled: 'cancel',
  cost: 'price',
  pricing: 'price',
  fee: 'price',
  fees: 'price',
  opening: 'hours',
  open: 'hours',
  closing: 'hours',
  schedule: 'hours',
  located: 'address',
  location: 'address',
  telephone: 'phone',
  call: 'phone',
};

const stopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'at',
  'can',
  'could',
  'do',
  'does',
  'for',
  'have',
  'has',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'of',
  'on',
  'or',
  'our',
  'please',
  'that',
  'the',
  'this',
  'to',
  'we',
  'what',
  'when',
  'where',
  'you',
  'your',
]);

export function normalizedKnowledgeTokens(text: string) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((token) => {
      const canonical = synonyms[token] ?? token;
      const singular =
        canonical.length > 4 &&
        canonical.endsWith('s') &&
        !canonical.endsWith('ss')
          ? canonical.slice(0, -1)
          : canonical;
      return synonyms[singular] ?? singular;
    })
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function hash(value: string, seed: number) {
  let result = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

export function createLocalEmbedding(
  text: string,
  dimensions = LOCAL_EMBEDDING_DIMENSIONS,
) {
  const tokens = normalizedKnowledgeTokens(text);
  const features = [
    ...tokens,
    ...tokens
      .slice(0, -1)
      .map((token, index) => `${token}_${tokens[index + 1]}`),
  ];
  const vector = Array<number>(dimensions).fill(0);

  for (const feature of features) {
    const position = hash(feature, 2_166_136_261) % dimensions;
    const sign = hash(feature, 2_654_435_761) % 2 === 0 ? 1 : -1;
    vector[position] += sign;
  }

  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value * value, 0),
  );
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
}

export function lexicalKnowledgeSimilarity(query: string, content: string) {
  const queryTokens = new Set(normalizedKnowledgeTokens(query));
  const contentTokens = new Set(normalizedKnowledgeTokens(content));
  if (queryTokens.size === 0 || contentTokens.size === 0) return 0;

  let matches = 0;
  for (const token of queryTokens) {
    if (contentTokens.has(token)) matches += 1;
  }
  return matches / queryTokens.size;
}

export class LocalEmbeddingProvider implements KnowledgeEmbeddingProvider {
  embedMany(texts: string[]): Promise<KnowledgeEmbeddingBatch> {
    return Promise.resolve({
      model: LOCAL_EMBEDDING_MODEL,
      vectors: texts.map((text) => createLocalEmbedding(text)),
    });
  }
}
