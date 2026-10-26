import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestApp,
  cleanDatabase,
  loginAs,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
  TEST_EQUIPES,
} from './helpers.js';
import { StatutDossier } from '@isieco/shared';
import { getDb } from '../src/db/index.js';
import crypto from 'node:crypto';

describe('Jalon M6 (Tranche 5) — Audit Immuable, Idempotence & Intégrité des Cibles', () => {
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

  // Helper pour créer un dossier de base
  async function createDossier() {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const res = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Audit & Idempotence Dakar',
        latitude: 14.6711,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    return res.json().idDossier;
  }

  // --------------------------------------------------------------------------
  // Test d'acceptation T16 : Idempotence stricte par referenceOperationUnique
  // --------------------------------------------------------------------------
  it("T16: Répétition d'une requête avec la même referenceOperationUnique : un seul enregistrement conservé", async () => {
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createDossier();
    const opRef = `OP-AFF-${Date.now()}-UNIQUE-123`;

    // 1. Premier envoi de la requête d'affectation avec la clé d'idempotence
    const aff1 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Mission avec clé d idempotence',
        referenceOperationUnique: opRef,
      },
    });
    expect(aff1.statusCode).toBe(201);
    const idAff1 = aff1.json().idAffectation;

    // 2. Répétition exacte de la requête avec la même clé (réseau rejoué / retry client)
    const aff2 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Mission avec clé d idempotence',
        referenceOperationUnique: opRef,
      },
    });

    // Règle T16 : Réponse 200 idempotente retournant le même identifiant sans créer de doublon
    expect(aff2.statusCode).toBe(200);
    expect(aff2.json().idempotent).toBe(true);
    expect(aff2.json().idAffectation).toBe(idAff1);

    // Vérification en base : exactement UNE ligne d'affectation
    const db = getDb();
    const rows = await db.query(
      `SELECT id_affectation FROM affectation WHERE reference_operation_unique = $1`,
      [opRef]
    );
    expect(rows.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Tests T17 & T32 : Contrainte d'exclusion stricte des cibles sur EVENEMENT_METIER
  // --------------------------------------------------------------------------
  it("T17 & T32: Rejet strict de tout événement sans cible ou ayant plus d'une cible simple (ck_evenement_exclusive_target)", async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const idDossier = await createDossier();

    // 1. Événement avec ZÉRO cible (Rejet T17 / T32)
    const resZeroTarget = await app.inject({
      method: 'POST',
      url: '/api/evenements',
      headers: admin.headers,
      payload: {
        typeEvenement: 'ANOMALIE_SANS_CIBLE',
        motif: 'Tentative événement orphelin sans cible',
      },
    });
    expect(resZeroTarget.statusCode).toBe(400);
    expect(resZeroTarget.json().error.message).toMatch(/exactement une cible principale/i);

    // 2. Événement avec DEUX cibles simultanées (Rejet T17 / T32)
    const resDoubleTarget = await app.inject({
      method: 'POST',
      url: '/api/evenements',
      headers: admin.headers,
      payload: {
        typeEvenement: 'ANOMALIE_DOUBLE_CIBLE',
        idDossierCible: idDossier,
        idTypeDechetCible: TEST_TYPES_DECHETS.PLASTIQUE, // 2 cibles simples fournies !
        motif: 'Tentative événement multi-cibles',
      },
    });
    expect(resDoubleTarget.statusCode).toBe(400);
    expect(resDoubleTarget.json().error.message).toMatch(/plusieurs entités/i);
  });

  it('filtre les événements demandés par les droits du rôle sans les remplacer par le filtre utilisateur', async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const qualification = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const idDossier = await createDossier();

    for (const typeEvenement of ['DOSSIER_CREE', 'SIGNALEMENT_RECU']) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/evenements',
        headers: admin.headers,
        payload: {
          typeEvenement,
          idDossierCible: idDossier,
          motif: `Événement de test ${typeEvenement}`,
        },
      });
      expect(created.statusCode).toBe(201);
    }

    const hidden = await app.inject({
      method: 'GET',
      url: '/api/evenements/audit-trail?typeEvenement=DOSSIER_CREE',
      headers: qualification.headers,
    });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json().data).toHaveLength(0);

    const visible = await app.inject({
      method: 'GET',
      url: '/api/evenements/audit-trail?typeEvenement=SIGNALEMENT_RECU',
      headers: qualification.headers,
    });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().data.map((event: { typeEvenement: string }) => event.typeEvenement))
      .toEqual(['SIGNALEMENT_RECU']);
  });

  // --------------------------------------------------------------------------
  // Tests T33 & T34 : Validation de la cible composite CONTENU_DOSSIER
  // --------------------------------------------------------------------------
  it("T33 & T34: Rejet d'une cible composite partielle (T33) ou pointant vers un couple inexistant (T34)", async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const idDossier = await createDossier();

    // 1. Cible composite partielle : seul idDossierContenuCible est fourni sans idTypeDechet (Rejet T33)
    const resPartielle = await app.inject({
      method: 'POST',
      url: '/api/evenements',
      headers: admin.headers,
      payload: {
        typeEvenement: 'TEST_CIBLE_PARTIELLE',
        idDossierContenuCible: idDossier,
        // idTypeDechetContenuCible omis !
        motif: 'Cible composite incomplète',
      },
    });
    expect(resPartielle.statusCode).toBe(400);
    expect(resPartielle.json().error.message).toMatch(/composite incomplète/i);

    // 2. Cible composite pointant vers un couple dossier/catégorie inexistant (Rejet T34)
    const resInexistant = await app.inject({
      method: 'POST',
      url: '/api/evenements',
      headers: admin.headers,
      payload: {
        typeEvenement: 'TEST_COUPLE_INEXISTANT',
        idDossierContenuCible: idDossier,
        idTypeDechetContenuCible: TEST_TYPES_DECHETS.METAUX, // Métaux n'est pas dans ce dossier !
        motif: 'Couple inexistant',
      },
    });
    expect(resInexistant.statusCode).toBe(400);
    expect(resInexistant.json().error.message).toMatch(/couple dossier\/catégorie inexistant/i);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T18 : Correction d'événement avec conservation de l'original
  // --------------------------------------------------------------------------
  it("T18: Correction d'événement : l'original reste immuable, le nouvel événement pointe vers idEvenementCorrige", async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const idDossier = await createDossier();

    // 1. Création d'un événement métier légitime
    const evtInitial = await app.inject({
      method: 'POST',
      url: '/api/evenements',
      headers: admin.headers,
      payload: {
        typeEvenement: 'OBSERVATION_INITIALE',
        idDossierCible: idDossier,
        motif: 'Observation enregistrée sur le dossier',
      },
    });
    expect(evtInitial.statusCode).toBe(201);
    const idEvtInitial = evtInitial.json().idEvenement;

    // 2. Rectification administrative de l'événement avec motif explicite
    const corrigerRes = await app.inject({
      method: 'POST',
      url: `/api/evenements/${idEvtInitial}/corriger`,
      headers: admin.headers,
      payload: {
        nouveauType: 'OBSERVATION_RECTIFIEE',
        motif: 'Erreur matérielle dans la transcription du constat initial',
        donneesApres: { observationCorrigee: 'Dépôt estimé à 800 kg au lieu de 500 kg' },
      },
    });
    expect(corrigerRes.statusCode).toBe(201);
    const idEvtCorrige = corrigerRes.json().idEvenement;

    // 3. Règle T18 : L'événement d'origine est INCHANGÉ en base
    const db = getDb();
    const originalRow = await db.queryOne<{ id_evenement: string; type_evenement: string; id_evenement_corrige: string | null }>(
      `SELECT id_evenement, type_evenement, id_evenement_corrige FROM evenement_metier WHERE id_evenement = $1`,
      [idEvtInitial]
    );
    expect(originalRow!.type_evenement).toBe('OBSERVATION_INITIALE');
    expect(originalRow!.id_evenement_corrige).toBeNull(); // L'original ne pointe vers rien

    // 4. Le nouvel événement pointe vers l'original via id_evenement_corrige
    const nouveauRow = await db.queryOne<{ id_evenement: string; type_evenement: string; id_evenement_corrige: string }>(
      `SELECT id_evenement, type_evenement, id_evenement_corrige FROM evenement_metier WHERE id_evenement = $1`,
      [idEvtCorrige]
    );
    expect(nouveauRow!.type_evenement).toBe('OBSERVATION_RECTIFIEE');
    expect(nouveauRow!.id_evenement_corrige).toBe(idEvtInitial);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T19 : Distinction dateEvenement vs dateEnregistrement
  // --------------------------------------------------------------------------
  it("T19: Distinction temporelle stricte entre dateEvenement (réalisation) et dateEnregistrement (système)", async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const idDossier = await createDossier();

    // Acte réalisé sur le terrain hier (24h avant saisie)
    const dateRealisationPasse = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const evtRes = await app.inject({
      method: 'POST',
      url: '/api/evenements',
      headers: admin.headers,
      payload: {
        typeEvenement: 'CONSTAT_DIFFERE',
        dateEvenement: dateRealisationPasse,
        idDossierCible: idDossier,
        motif: 'Saisie différée d un constat terrain réalisé la veille',
      },
    });
    expect(evtRes.statusCode).toBe(201);
    const idEvt = evtRes.json().idEvenement;

    // Vérification en base
    const db = getDb();
    const row = await db.queryOne<{ date_evenement: string; date_enregistrement: string }>(
      `SELECT date_evenement, date_enregistrement FROM evenement_metier WHERE id_evenement = $1`,
      [idEvt]
    );

    const dEvt = new Date(row!.date_evenement).getTime();
    const dEnreg = new Date(row!.date_enregistrement).getTime();

    // dateEvenement est ~24h antérieure à dateEnregistrement
    expect(dEnreg - dEvt).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T35 : Recalcul transactionnel du statut global du dossier
  // --------------------------------------------------------------------------
  it("T35: Recalcul déterministe du statut global du dossier dans la transaction d'affectation", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);

    // 1. Création dossier -> Statut initial : EN_ATTENTE_AFFECTATION
    const dos = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Test Statut Recalculé',
        latitude: 14.6711,
        longitude: -17.433,
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE },
          { idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE },
        ],
      },
    });
    const idDossier = dos.json().idDossier;

    const db = getDb();
    const avantAff = await db.queryOne<{ statut_dossier: string }>(
      `SELECT statut_dossier FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier]
    );
    expect(avantAff!.statut_dossier).toBe(StatutDossier.EN_ATTENTE_AFFECTATION);
    await db.execute(
      `UPDATE contenu_dossier
       SET etat_prise_en_charge = 'EN_ATTENTE_EQUIPE',
           date_attente_equipe = CURRENT_TIMESTAMP,
           motif_attente_equipe = 'Équipe indisponible au premier passage'
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
    );

    // 2. Un volet non affecté garde le statut global en attente après la première affectation.
    await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
      },
    });
    const apresPremiereAff = await db.queryOne<{
      statut_dossier: string;
      etat_prise_en_charge: string;
      date_attente_equipe: Date | null;
      motif_attente_equipe: string | null;
    }>(
      `SELECT d.statut_dossier, c.etat_prise_en_charge, c.date_attente_equipe, c.motif_attente_equipe
       FROM dossier_traitement d
       JOIN contenu_dossier c ON c.id_dossier = d.id_dossier
       WHERE d.id_dossier = $1 AND c.id_type_dechet = $2`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
    );
    expect(apresPremiereAff).toMatchObject({
      statut_dossier: StatutDossier.EN_ATTENTE_AFFECTATION,
      etat_prise_en_charge: 'AFFECTEE',
      date_attente_equipe: null,
      motif_attente_equipe: null,
    });

    // 3. Lorsque tous les volets sont affectés, le dossier passe en traitement.
    await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE,
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idCompetenceEquipe: TEST_EQUIPES.BIO_MEDINA.competenceOrganique,
      },
    });

    const apresAff = await db.queryOne<{ statut_dossier: string }>(
      `SELECT statut_dossier FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier]
    );
    expect(apresAff!.statut_dossier).toBe(StatutDossier.EN_COURS_DE_TRAITEMENT);

    await db.execute(
      `UPDATE contenu_dossier
       SET etat_prise_en_charge = CASE
         WHEN id_type_dechet = $2 THEN 'A_VERIFIER'
         ELSE 'AFFECTEE'
       END
       WHERE id_dossier = $1`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
    );
    const activeWorkWins = await db.queryOne<{ statut_dossier: string }>(
      `SELECT recalculer_statut_dossier($1) AS statut_dossier`,
      [idDossier],
    );
    expect(activeWorkWins!.statut_dossier).toBe(StatutDossier.EN_COURS_DE_TRAITEMENT);

    await db.execute(
      `UPDATE contenu_dossier
       SET etat_prise_en_charge = 'TERMINEE'
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [idDossier, TEST_TYPES_DECHETS.ORGANIQUE],
    );
    const verificationPending = await db.queryOne<{ statut_dossier: string }>(
      `SELECT recalculer_statut_dossier($1) AS statut_dossier`,
      [idDossier],
    );
    expect(verificationPending!.statut_dossier).toBe(StatutDossier.EN_ATTENTE_VERIFICATION);

    await db.execute(
      `UPDATE contenu_dossier
       SET etat_prise_en_charge = 'TERMINEE'
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
    );
    const readyToClose = await db.queryOne<{ statut_dossier: string }>(
      `SELECT recalculer_statut_dossier($1) AS statut_dossier`,
      [idDossier],
    );
    expect(readyToClose!.statut_dossier).toBe(StatutDossier.EN_ATTENTE_VERIFICATION);
  });
});
