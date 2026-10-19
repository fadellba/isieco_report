import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode, ResultatVerification, EtatVerification, StatutDossier, EtatAffectation } from '@isieco/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import crypto from 'node:crypto';

export const verificationsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedVerifiers = [RoleCode.VERIFICATION];

  // Enregistrement d'une vérification de résolution par volet (UC08 / T12 / T25)
  fastify.post('/', {
    preHandler: [fastify.authorize(allowedVerifiers)],
    schema: {
      tags: ['Vérifications'],
      summary: 'Enregistrer une vérification qualité de résolution par volet (UC08 / T12 / T25)',
      description: 'Enregistre le constat d un vérificateur indépendant. Si CONFORME_RESOLU, l affectation passe à TERMINEE. Si non conforme, l affectation repasse à ACTIVE pour reprise.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['idAffectation', 'resultatVerification'],
        properties: {
          idAffectation: { type: 'string', format: 'uuid', description: 'ID de l affectation à vérifier' },
          resultatVerification: { type: 'string', enum: Object.values(ResultatVerification) },
          motif: { type: 'string' },
          referencePreuve: { type: 'string', description: 'Référence photo ou document de contre-visite' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idVerification: { type: 'string', format: 'uuid' },
            resultatVerification: { type: 'string' },
            etatVerification: { type: 'string', example: 'COURANTE' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const {
      idAffectation,
      resultatVerification,
      motif,
      referencePreuve,
    } = req.body as {
      idAffectation: string;
      resultatVerification: ResultatVerification;
      motif?: string;
      referencePreuve?: string;
    };

    if (!idAffectation || !resultatVerification) {
      throw new BadRequestError("L'identifiant de l'affectation et le résultat de vérification sont obligatoires.");
    }

    const db = getDb();
    const affectation = await db.queryOne<{
      id_affectation: string;
      id_dossier: string;
      id_type_dechet: string;
      etat_affectation: string;
      date_fin_affectation: string | null;
    }>(
      `SELECT id_affectation, id_dossier, id_type_dechet, etat_affectation, date_fin_affectation
       FROM affectation WHERE id_affectation = $1`,
      [idAffectation]
    );

    if (!affectation) throw new NotFoundError('Affectation introuvable.');
    if (affectation.etat_affectation !== EtatAffectation.A_VERIFIER || affectation.date_fin_affectation) {
      throw new BadRequestError("Seule une affectation active en attente de vérification peut être contrôlée.");
    }

    const intervention = await db.queryOne<{ id_intervention: string }>(
      `SELECT id_intervention FROM intervention
       WHERE id_affectation = $1 AND statut_intervention = 'TERMINEE'
       ORDER BY date_heure_fin DESC LIMIT 1`,
      [idAffectation]
    );
    if (!intervention) {
      throw new BadRequestError("Aucune intervention terminée ne peut être vérifiée pour cette affectation.");
    }

    const interventionActor = await db.queryOne<{ id_acteur: string | null }>(
      `SELECT id_acteur FROM evenement_metier
       WHERE id_intervention_cible = $1 AND type_evenement = 'INTERVENTION_TERMINEE'
       ORDER BY date_enregistrement DESC LIMIT 1`,
      [intervention.id_intervention]
    );
    if (!interventionActor?.id_acteur) {
      throw new BadRequestError("La trace de l'agent ayant terminé l'intervention est introuvable.");
    }
    const executedByVerifier = await db.queryOne<{ id_evenement: string }>(
      `SELECT em.id_evenement
       FROM evenement_metier em
       JOIN intervention i ON i.id_intervention = em.id_intervention_cible
       WHERE i.id_affectation = $1
         AND i.statut_intervention = 'TERMINEE'
         AND em.type_evenement = 'INTERVENTION_TERMINEE'
         AND em.id_acteur = $2
       LIMIT 1`,
      [idAffectation, req.user!.idUtilisateur]
    );
    if (executedByVerifier) {
      throw new ForbiddenError("L'agent ayant réalisé l'intervention ne peut pas vérifier sa propre intervention.");
    }

    const idVerification = crypto.randomUUID();

    await db.transaction(async (trx) => {
      // Règle T25 : Une seule vérification reste COURANTE par affectation
      await trx.execute(
        `UPDATE verification_resolution
         SET etat_verification = 'REMPLACEE'
         WHERE id_affectation = $1 AND etat_verification = 'COURANTE'`,
        [idAffectation]
      );

      // Insertion de la nouvelle vérification courante
      await trx.execute(
        `INSERT INTO verification_resolution (
           id_verification, id_affectation, id_verificateur, date_verification,
           resultat_verification, etat_verification, motif, reference_preuve
         ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'COURANTE', $5, $6)`,
        [
          idVerification,
          idAffectation,
          req.user!.idUtilisateur,
          resultatVerification,
          motif || null,
          referencePreuve || null,
        ]
      );

      // Règle T12 : Si résolution positive, clôture du volet (affectation TERMINEE)
      if (resultatVerification === ResultatVerification.CONFORME_RESOLU) {
        await trx.execute(
          `UPDATE affectation 
           SET etat_affectation = 'TERMINEE', date_fin_affectation = CURRENT_TIMESTAMP
           WHERE id_affectation = $1`,
          [idAffectation]
        );

        await trx.execute(
          `INSERT INTO evenement_metier (
             id_evenement, type_evenement, origine, id_acteur, id_verification_cible, motif
           ) VALUES ($1, 'RESOLUTION_CONFIRMEE', 'PORTAIL_GESTION', $2, $3, $4)`,
          [crypto.randomUUID(), req.user!.idUtilisateur, idVerification, motif || 'Résolution validée par le vérificateur']
        );
      } 
      // Si résolution partielle ou négative : le volet reste à traiter (Test T12)
      else {
        await trx.execute(
          `UPDATE affectation 
           SET etat_affectation = 'ACTIVE'
           WHERE id_affectation = $1`,
          [idAffectation]
        );

        await trx.execute(
          `INSERT INTO evenement_metier (
             id_evenement, type_evenement, origine, id_acteur, id_verification_cible, motif
           ) VALUES ($1, 'VERIFICATION_ENREGISTREE', 'PORTAIL_GESTION', $2, $3, $4)`,
          [crypto.randomUUID(), req.user!.idUtilisateur, idVerification, motif || 'Intervention non conforme ou partielle : reprise nécessaire']
        );

        await trx.execute(
          `INSERT INTO intervention (id_intervention, id_affectation, statut_intervention, renseigne_par)
           VALUES ($1, $2, 'PROGRAMMEE', $3)`,
          [crypto.randomUUID(), idAffectation, req.user!.idUtilisateur]
        );
      }
    });

    return reply.status(201).send({
      success: true,
      idVerification,
      resultatVerification,
      etatVerification: EtatVerification.COURANTE,
      message: 'Vérification enregistrée avec succès (Test T25).',
    });
  });

  // Clôture globale d'un dossier avec règle stricte à 100% (UC09 / T13 / T14)
  fastify.post('/dossiers/:id/cloturer', {
    preHandler: [fastify.authorize(allowedVerifiers)],
    schema: {
      tags: ['Vérifications'],
      summary: 'Clôture globale d un dossier à 100% de résolution confirmée (UC09 / T13 / T14)',
      description: 'Vérifie que 100% des volets inclus ont une affectation TERMINEE avec vérification COURANTE = CONFORME_RESOLU (T13). Notifie ensuite tous les citoyens rattachés.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier à clôturer' },
        },
      },
      body: {
        type: 'object',
        properties: {
          motif: { type: 'string', description: 'Motif ou observation finale de clôture' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            statutDossier: { type: 'string', example: 'CLOS_RESOLUTION_CONFIRMEE' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif?: string };
    const db = getDb();

    const dossier = await db.queryOne<{ id_dossier: string; statut_dossier: string }>(
      `SELECT id_dossier, statut_dossier FROM dossier_traitement WHERE id_dossier = $1`,
      [id]
    );
    if (!dossier) throw new NotFoundError('Dossier introuvable.');

    // 1. Récupérer tous les volets INCLUSE du dossier
    const voletsInclus = await db.query<{ id_type_dechet: string; code_type: string }>(
      `SELECT cd.id_type_dechet, td.code_type 
       FROM contenu_dossier cd
       JOIN type_dechet td ON cd.id_type_dechet = td.id_type_dechet
       WHERE cd.id_dossier = $1 AND cd.etat_contenu_dossier = 'INCLUSE'`,
      [id]
    );

    if (voletsInclus.length === 0) {
      throw new BadRequestError('Le dossier ne comporte aucun volet technique actif à traiter.');
    }

    // 2. Vérifier que 100% des volets inclus ont une affectation TERMINEE avec vérification CONFORME_RESOLU (T13 / T14)
    const nonResolus: string[] = [];
    for (const volet of voletsInclus) {
      const resolu = await db.queryOne<{ id_affectation: string }>(
        `SELECT a.id_affectation 
         FROM affectation a
         JOIN verification_resolution vr ON a.id_affectation = vr.id_affectation
         WHERE a.id_dossier = $1 
           AND a.id_type_dechet = $2 
           AND a.etat_affectation = 'TERMINEE'
           AND vr.etat_verification = 'COURANTE'
           AND vr.resultat_verification = 'CONFORME_RESOLU'`,
        [id, volet.id_type_dechet]
      );
      if (!resolu) {
        nonResolus.push(volet.code_type);
      }
    }

    // Règle T13 : Si une seule catégorie reste non résolue, le dossier ne peut pas être clos
    if (nonResolus.length > 0) {
      throw new BadRequestError(
        `Clôture impossible : 100% des volets inclus doivent être résolus et vérifiés avec succès. Volet(s) non résolu(s) : [${nonResolus.join(', ')}] (Test T13).`
      );
    }

    // Règle T14 : Clôture résolue autorisée à 100%
    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE dossier_traitement 
         SET statut_dossier = 'CLOS_RESOLUTION_CONFIRMEE', date_cloture = CURRENT_TIMESTAMP
         WHERE id_dossier = $1`,
        [id]
      );

      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_dossier_cible, motif
         ) VALUES ($1, 'DOSSIER_CLOS', 'PORTAIL_GESTION', $2, $3, $4)`,
        [crypto.randomUUID(), req.user!.idUtilisateur, id, motif || 'Clôture complète suite à vérification positive de tous les volets']
      );

      // Notifier les citoyens déclarants rattachés à ce dossier
      const declarants = await trx.query<{ id_utilisateur: string }>(
        `SELECT DISTINCT s.id_utilisateur 
         FROM rattachement_signalement rs
         JOIN signalement s ON rs.id_signalement = s.id_signalement
         WHERE rs.id_dossier = $1 AND rs.date_fin_rattachement IS NULL`,
        [id]
      );

      for (const dec of declarants) {
        await trx.execute(
          `INSERT INTO notification (id_notification, id_utilisateur, titre, message, lien_cible)
           VALUES ($1, $2, 'Dépôt résolu et nettoyé', 'Le dépôt de déchets que vous avez signalé a été entièrement traité et sa propreté vérifiée par nos services. Merci pour votre contribution citoyenne !', $3)`,
          [crypto.randomUUID(), dec.id_utilisateur, `/dossiers/${id}`]
        );
      }
    });

    return {
      success: true,
      statutDossier: StatutDossier.CLOS_RESOLUTION_CONFIRMEE,
      message: 'Dossier clôturé avec succès après vérification complète à 100% (Test T14).',
    };
  });

  // Réouverture d'un dossier clôturé avec motif obligatoire (UC09 / T15 / T36)
  fastify.post('/dossiers/:id/reouvrir', {
    preHandler: [fastify.authorize(allowedVerifiers)],
    schema: {
      tags: ['Vérifications'],
      summary: 'Réouverture motivée d un dossier préalablement clôturé (UC09 / T15 / T36)',
      description: 'Repasse le dossier clôturé à l état A_QUALIFIER sans écraser ni supprimer l historique passé des interventions et vérifications.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier à rouvrir' },
        },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          motif: { type: 'string', minLength: 10, description: 'Motif explicite obligatoire de réouverture (min 10 car.)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            statutDossier: { type: 'string', example: 'A_QUALIFIER' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif: string };

    if (!motif || motif.trim().length < 10) {
      throw new BadRequestError("Un motif explicite d'au moins 10 caractères est obligatoire pour rouvrir un dossier (Test T15 / T36).");
    }

    const db = getDb();
    const dossier = await db.queryOne<{ id_dossier: string; statut_dossier: string }>(
      `SELECT id_dossier, statut_dossier FROM dossier_traitement WHERE id_dossier = $1`,
      [id]
    );

    if (!dossier) throw new NotFoundError('Dossier introuvable.');
    if (!['CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE'].includes(dossier.statut_dossier)) {
      throw new BadRequestError("Seul un dossier préalablement clôturé peut faire l'objet d'une réouverture.");
    }

    const statutAvant = dossier.statut_dossier;

    await db.transaction(async (trx) => {
      // Règle T15 & T36 : Repasse à A_QUALIFIER sans écraser les affectations et vérifications passées
      await trx.execute(
        `UPDATE dossier_traitement 
         SET statut_dossier = 'A_QUALIFIER'
         WHERE id_dossier = $1`,
        [id]
      );

      // Traçabilité immuable DOSSIER_REOUVERT
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_dossier_cible,
           donnees_avant, donnees_apres, motif
         ) VALUES ($1, 'DOSSIER_REOUVERT', 'PORTAIL_GESTION', $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          id,
          JSON.stringify({ statutDossier: statutAvant }),
          JSON.stringify({ statutDossier: 'A_QUALIFIER' }),
          motif.trim(),
        ]
      );
    });

    return {
      success: true,
      statutDossier: StatutDossier.A_QUALIFIER,
      message: "Dossier rouvert avec succès et conservé dans l'historique (Test T15 / T36).",
    };
  });
};
