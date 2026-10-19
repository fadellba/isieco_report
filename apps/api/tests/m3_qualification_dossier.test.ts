import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanDatabase, loginAs, TEST_PERSONAS, TEST_TYPES_DECHETS } from './helpers.js';
import { StatutSignalement, StatutDossier } from '@isieco/shared';
import { getDb } from '../src/db/index.js';

describe('Jalon M3 (Tranche 2) — Qualification, Doublons & Dossier Opérationnel', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T03 : Rapprochement de deux signalements d'un même dépôt
  // --------------------------------------------------------------------------
  it("T03: Deux signalements d'un même dépôt rattachés à un dossier commun sans suppression des auteurs", async () => {
    const citoyen1 = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const citoyen2 = await loginAs(app, TEST_PERSONAS.CITOYEN_2.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);

    // 1. Deux citoyens distincts signalent le même dépôt (coordonnées proches Dakar-Plateau)
    const sig1 = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen1.headers,
      payload: {
        description: 'Amas d ordures plastiques près du marché Kermel',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSig1 = sig1.json().idSignalement;

    const sig2 = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen2.headers,
      payload: {
        description: 'Gros tas de plastiques bloquant le caniveau Kermel',
        latitude: 14.6712,
        longitude: -17.4331,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSig2 = sig2.json().idSignalement;

    // 2. Détection de doublons par l'agent de qualification (UC03)
    const doublonsRes = await app.inject({
      method: 'GET',
      url: `/api/qualification/doublons-candidats/${idSig2}`,
      headers: qualif.headers,
    });
    expect(doublonsRes.statusCode).toBe(200);
    const doublons = doublonsRes.json();
    expect(doublons.count).toBeGreaterThanOrEqual(1);
    expect(doublons.candidates.some((d: any) => d.idSignalement === idSig1)).toBe(true);

    // 3. Qualification des deux signalements
    await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSig1}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Signalement initial valide' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSig2}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Doublon confirmé sur le même dépôt' },
    });

    // 4. Création d'un unique dossier commun par le responsable de traitement
    const dossierRes = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Kermel - Déblaiement plastique',
        latitude: 14.6711,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(dossierRes.statusCode).toBe(201);
    const idDossier = dossierRes.json().idDossier;

    // 5. Rattachement des deux signalements au dossier commun
    const ratt1 = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: idSig1, typeRattachement: 'PRINCIPAL' },
    });
    expect(ratt1.statusCode).toBe(200);

    const ratt2 = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: idSig2, typeRattachement: 'CONFIRMATION' },
    });
    expect(ratt2.statusCode).toBe(200);

    // 6. Vérification en base : les deux signalements conservent leurs auteurs originaux intacts
    const db = getDb();
    const rows = await db.query(
      `SELECT s.id_signalement, s.id_utilisateur, s.statut_signalement, rs.type_rattachement
       FROM signalement s
       JOIN rattachement_signalement rs ON s.id_signalement = rs.id_signalement
       WHERE rs.id_dossier = $1`,
      [idDossier]
    );

    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.id_utilisateur)).toContain(TEST_PERSONAS.CITOYEN.id);
    expect(rows.map((r) => r.id_utilisateur)).toContain(TEST_PERSONAS.CITOYEN_2.id);
    expect(rows.every((r) => r.statut_signalement === StatutSignalement.RATTACHE)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T04 : Machine d'état et correction sans suppression
  // --------------------------------------------------------------------------
  it("T04: Transition d'état rigoureuse et correction de rattachement avec conservation d'historique", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);

    // 1. Signalement créé (statut initial: SOUMIS)
    const sig = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Gravats de démolition Médina rue 6',
        latitude: 14.685,
        longitude: -17.442,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.GRAVATS }],
      },
    });
    const idSig = sig.json().idSignalement;
    expect(sig.json().statut).toBe(StatutSignalement.SOUMIS);

    // 2. Passage à ACCEPTE_POUR_RATTACHEMENT lors de la qualification
    const qualifRes = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSig}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Examen favorable' },
    });
    expect(qualifRes.json().statut).toBe(StatutSignalement.ACCEPTE_POUR_RATTACHEMENT);

    // 3. Création de deux dossiers
    const dos1 = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier 1 - Médina rue 6',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.GRAVATS }],
      },
    });
    const idDos1 = dos1.json().idDossier;

    const dos2 = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier 2 - Médina rue 8 (Cible rectifiée)',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.GRAVATS }],
      },
    });
    const idDos2 = dos2.json().idDossier;

    // 4. Rattachement initial au Dossier 1 -> Statut passe à RATTACHE
    await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos1}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: idSig },
    });

    // 5. Correction du rattachement : transfert vers Dossier 2 avec motif obligatoire
    const corrigerRes = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos1}/corriger-rattachement`,
      headers: traitement.headers,
      payload: {
        idSignalement: idSig,
        nouveauIdDossier: idDos2,
        motif: 'Erreur d orientation initiale, le dépôt se situe au niveau de la rue 8',
      },
    });
    expect(corrigerRes.statusCode).toBe(200);

    // 6. Règle T04 : Conservation de l'historique sans suppression physique
    const db = getDb();
    const rattachements = await db.query(
      `SELECT id_rattachement, id_dossier, date_debut_rattachement, date_fin_rattachement, motif
       FROM rattachement_signalement
       WHERE id_signalement = $1
       ORDER BY date_debut_rattachement ASC`,
      [idSig]
    );

    // Deux enregistrements doivent être présents dans la table
    expect(rattachements.length).toBe(2);
    // Le premier rattachement est archivé (date_fin NOT NULL)
    expect(rattachements[0].id_dossier).toBe(idDos1);
    expect(rattachements[0].date_fin_rattachement).not.toBeNull();
    // Le second rattachement est actif (date_fin IS NULL)
    expect(rattachements[1].id_dossier).toBe(idDos2);
    expect(rattachements[1].date_fin_rattachement).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T26 : Multi-catégories et unicité CONTENU_DOSSIER
  // --------------------------------------------------------------------------
  it("T26: Signalement multi-catégories rapproché d'un signalement partiel : unicité stricte CONTENU_DOSSIER", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);

    // Création d'un dossier avec Plastique et Gravats
    const dos = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Multi-Types Boulevard de la République',
        priorite: 'FAIBLE',
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE, quantiteEstimee: '1 tonne' },
          { idTypeDechet: TEST_TYPES_DECHETS.GRAVATS, volumeEstime: '5 m3' },
        ],
      },
    });
    const idDos = dos.json().idDossier;

    // Signalement 1 contenant Plastique, Gravats et Métaux (3 types)
    const sig1 = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt mixte complexe',
        latitude: 14.675,
        longitude: -17.435,
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE },
          { idTypeDechet: TEST_TYPES_DECHETS.GRAVATS },
          { idTypeDechet: TEST_TYPES_DECHETS.METAUX },
        ],
      },
    });
    const idSig1 = sig1.json().idSignalement;

    // Rapprochement du signalement au dossier
    await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: idSig1 },
    });

    const db = getDb();
    const inheritedLocation = await db.queryOne<{ latitude: number; longitude: number; priorite: string }>(
      `SELECT latitude, longitude, priorite FROM dossier_traitement WHERE id_dossier = $1`,
      [idDos]
    );
    expect(Number(inheritedLocation!.latitude)).toBeCloseTo(14.675);
    expect(Number(inheritedLocation!.longitude)).toBeCloseTo(-17.435);
    expect(inheritedLocation!.priorite).toBe('FAIBLE');

    // Ajout explicite du volet Métaux dans le dossier
    const addVolet = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos}/categories`,
      headers: traitement.headers,
      payload: {
        idTypeDechet: TEST_TYPES_DECHETS.METAUX,
        quantiteEstimee: '300 kg',
      },
    });
    expect(addVolet.statusCode).toBe(201);

    // Tentative d'ajouter à nouveau la même catégorie Plastique -> 400 Bad Request
    const duplicateVolet = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos}/categories`,
      headers: traitement.headers,
      payload: {
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
      },
    });
    expect(duplicateVolet.statusCode).toBe(400);

    // Vérification de l'unicité stricte des catégories dans CONTENU_DOSSIER
    const categoriesDossier = await db.query(
      `SELECT id_type_dechet, etat_contenu_dossier FROM contenu_dossier WHERE id_dossier = $1`,
      [idDos]
    );

    expect(categoriesDossier.length).toBe(3); // Plastique, Gravats, Métaux (exactement 1 ligne par couple)
    const ids = categoriesDossier.map((c) => c.id_type_dechet);
    expect(new Set(ids).size).toBe(3);
  });

  it("T43: La priorité du dossier respecte les valeurs canoniques partagées et SQL", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const valide = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier priorité faible',
        priorite: 'FAIBLE',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(valide.statusCode).toBe(201);

    const legacyValue = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier priorité obsolète',
        priorite: 'BASSE',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(legacyValue.statusCode).toBe(400);
  });
});
