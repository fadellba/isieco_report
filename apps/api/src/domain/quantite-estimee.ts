export type QuantiteEstimeeNormalisee = {
  quantiteEstimee: string | null;
  uniteQuantite: string | null;
  quantiteEstimeeLegacy: string | null;
};

const NUMERIC_QUANTITY_WITH_UNIT =
  /^(\d{1,9}(?:[.,]\d{1,3})?)\s*([\p{L}µμ³][\p{L}\p{N}µμ³./_-]{0,29})$/u;

export function normaliserQuantiteEstimee(value?: string | null): QuantiteEstimeeNormalisee {
  const text = value?.trim();
  if (!text) {
    return { quantiteEstimee: null, uniteQuantite: null, quantiteEstimeeLegacy: null };
  }

  const match = NUMERIC_QUANTITY_WITH_UNIT.exec(text);
  if (!match) {
    return { quantiteEstimee: null, uniteQuantite: null, quantiteEstimeeLegacy: value ?? null };
  }

  return {
    quantiteEstimee: match[1].replace(',', '.'),
    uniteQuantite: match[2],
    quantiteEstimeeLegacy: null,
  };
}

export function formaterQuantiteEstimee(
  quantiteEstimee: string | null,
  uniteQuantite: string | null,
  quantiteEstimeeLegacy: string | null,
): string | null {
  if (quantiteEstimee === null && uniteQuantite === null) {
    return quantiteEstimeeLegacy;
  }
  if (quantiteEstimee === null || uniteQuantite === null) {
    throw new Error('Quantité numérique et unité incohérentes dans le stockage.');
  }
  return `${quantiteEstimee} ${uniteQuantite}`;
}
