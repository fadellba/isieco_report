import { describe, expect, it } from 'vitest';
import { formaterQuantiteEstimee, normaliserQuantiteEstimee } from '../src/domain/quantite-estimee.js';

describe('quantite estimee', () => {
  it.each([
    ['300 kg', '300', 'kg'],
    ['1,25 tonne', '1.25', 'tonne'],
    ['5 m3', '5', 'm3'],
  ])('normalise la valeur numérique %s avec son unité', (input, quantity, unit) => {
    expect(normaliserQuantiteEstimee(input)).toEqual({
      quantiteEstimee: quantity,
      uniteQuantite: unit,
      quantiteEstimeeLegacy: null,
    });
  });

  it.each(['Environ 400 kg', 'Bacs débordants'])('préserve une estimation qualitative : %s', (input) => {
    expect(normaliserQuantiteEstimee(input)).toEqual({
      quantiteEstimee: null,
      uniteQuantite: null,
      quantiteEstimeeLegacy: input,
    });
  });

  it('préserve exactement le texte libre existant', () => {
    expect(normaliserQuantiteEstimee('  Bacs débordants  ').quantiteEstimeeLegacy)
      .toBe('  Bacs débordants  ');
  });

  it('reconstitue la valeur texte exposée par le contrat API', () => {
    expect(formaterQuantiteEstimee('300', 'kg', null)).toBe('300 kg');
    expect(formaterQuantiteEstimee(null, null, 'Environ 400 kg')).toBe('Environ 400 kg');
  });

  it('signale une paire quantité/unité incohérente', () => {
    expect(() => formaterQuantiteEstimee('300', null, null)).toThrow(
      'Quantité numérique et unité incohérentes dans le stockage.',
    );
  });
});
