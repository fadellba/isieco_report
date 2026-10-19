import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode, StatutSignalement } from '@isieco/shared';
import { BadRequestError, NotFoundError } from '../../core/errors.js';
import crypto from 'node:crypto';

// Calcul distance géodésique (Haversine en mètres)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Rayon de la Terre en mètres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const qualificationRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedAgents = [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT];
  const allowedReaders = [...allowedAgents, RoleCode.ADMIN];

  // Boîte de réception pour examen (UC03)
  fastify.get('/boite-reception', {
    preHandler: [fastify.authorize(allowedReaders)],
    schema: {
      tags: ['Qualification'],
      summary: 'Boîte de réception des signalements à qualifier (UC03)',
      description: 'Renvoie la liste des signalements en attente ou en cours d examen par la cellule communale.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            count: { type: 'number' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idSignalement: { type: 'string', format: 'uuid' },
                  dateSoumission: { type: 'string' },
                  description: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  descriptionLocalisation: { type: 'string', nullable: true },
                  statutSignalement: { type: 'string' },
                  nomDeclarant: { type: 'string' },
                  prenomDeclarant: { type: 'string', nullable: true },
                  nbPhotos: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const db = getDb();
    const rows = await db.query(
      `SELECT s.id_signalement as "idSignalement",
              s.date_soumission as "dateSoumission",
              s.description,
              s.latitude,
              s.longitude,
              s.description_localisation as "descriptionLocalisation",
              s.statut_signalement as "statutSignalement",
              u.nom as "nomDeclarant",
              u.prenom as "prenomDeclarant",
              (SELECT count(*) FROM photo_signalement ps WHERE ps.id_signalement = s.id_signalement) as "nbPhotos"
       FROM signalement s
       JOIN utilisateur u ON s.id_utilisateur = u.id_utilisateur
       WHERE s.statut_signalement IN ('SOUMIS', 'EN_COURS_DE_QUALIFICATION')
       ORDER BY s.date_soumission ASC`
    );

    return { success: true, count: rows.length, data: rows };
  });

  // Début d'examen d'un signalement
  fastify.post('/signalements/:id/examiner', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Prendre en charge un signalement en qualification',
      description: 'Passe le signalement à l état EN_COURS_DE_QUALIFICATION et trace l événement.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();

    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE signalement SET statut_signalement = 'EN_COURS_DE_QUALIFICATION' WHERE id_signalement = $1`,
        [id]
      );
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_signalement_cible, motif
         ) VALUES ($1, 'SIGNALEMENT_EN_QUALIFICATION', 'PORTAIL_GESTION', $2, $3, 'Prise en charge par l''agent de qualification')`,
        [crypto.randomUUID(), req.user!.idUtilisateur, id]
      );
    });

    return { success: true, message: 'Signalement pris en cours de qualification.' };
  });

  // Acceptation pour rattachement (Test T04)
  fastify.post('/signalements/:id/qualifier', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Accepter le signalement pour traitement (+10 points citoyen) (Test T04)',
      description: 'Valide la recevabilité du signalement, notifie le citoyen et le crédite de 10 points éco-citoyen.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          motif: { type: 'string', example: 'Signalement recevable et conforme pour orientation vers dossier' },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif?: string };
    const db = getDb();

    const sig = await db.queryOne<{ id_utilisateur: string }>(
      `SELECT id_utilisateur FROM signalement WHERE id_signalement = $1`,
      [id]
    );
    if (!sig) throw new NotFoundError('Signalement introuvable.');

    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE signalement 
         SET statut_signalement = 'ACCEPTE_POUR_RATTACHEMENT',
             decision_par = $1,
             date_decision = CURRENT_TIMESTAMP,
             motif_decision = $2
         WHERE id_signalement = $3`,
        [req.user!.idUtilisateur, motif || 'Signalement recevable et conforme', id]
      );

      // Traçabilité immuable
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_signalement_cible, motif
         ) VALUES ($1, 'SIGNALEMENT_ACCEPTE', 'PORTAIL_GESTION', $2, $3, $4)`,
        [crypto.randomUUID(), req.user!.idUtilisateur, id, motif || 'Signalement recevable pour traitement']
      );

      // Attribution de points au citoyen déclarant (Extension valorisation citoyenne)
      await trx.execute(
        `INSERT INTO historique_points (id_point, id_utilisateur, id_signalement, points, motif)
         VALUES ($1, $2, $3, 10, 'Attribution pour signalement recevable')`,
        [crypto.randomUUID(), sig.id_utilisateur, id]
      );

      // Notification au citoyen
      await trx.execute(
        `INSERT INTO notification (id_notification, id_utilisateur, titre, message, lien_cible)
         VALUES ($1, $2, 'Signalement accepté (+10 points)', 'Votre signalement a été validé par les services et orienté vers un dossier d''intervention.', $3)`,
        [crypto.randomUUID(), sig.id_utilisateur, `/signalements/${id}`]
      );
    });

    return {
      success: true,
      statut: StatutSignalement.ACCEPTE_POUR_RATTACHEMENT,
      message: 'Signalement accepté pour rattachement avec attribution de 10 points.',
    };
  });

  // Rejet d'un signalement avec motif obligatoire (RG17)
  fastify.post('/signalements/:id/rejeter', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Rejeter un signalement avec motif obligatoire (RG17)',
      description: 'Rejette un signalement non recevable ou hors périmètre avec obligation de motif (>= 10 car.).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          motif: { type: 'string', minLength: 10, example: 'Dépôt situé sur domaine privé hors compétences de la voirie communale' },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif: string };

    if (!motif || motif.trim().length < 10) {
      throw new BadRequestError("Un motif explicite d'au moins 10 caractères est obligatoire pour rejeter un signalement (RG17).");
    }

    const db = getDb();
    const sig = await db.queryOne<{ id_utilisateur: string }>(
      `SELECT id_utilisateur FROM signalement WHERE id_signalement = $1`,
      [id]
    );
    if (!sig) throw new NotFoundError('Signalement introuvable.');

    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE signalement 
         SET statut_signalement = 'REJETE',
             decision_par = $1,
             date_decision = CURRENT_TIMESTAMP,
             motif_decision = $2
         WHERE id_signalement = $3`,
        [req.user!.idUtilisateur, motif.trim(), id]
      );

      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_signalement_cible, motif
         ) VALUES ($1, 'SIGNALEMENT_REJETE', 'PORTAIL_GESTION', $2, $3, $4)`,
        [crypto.randomUUID(), req.user!.idUtilisateur, id, motif.trim()]
      );

      await trx.execute(
        `INSERT INTO notification (id_notification, id_utilisateur, titre, message, lien_cible)
         VALUES ($1, $2, 'Signalement non retenu', $3, $4)`,
        [crypto.randomUUID(), sig.id_utilisateur, `Votre signalement n'a pas pu être retenu. Motif : ${motif.trim()}`, `/signalements/${id}`]
      );
    });

    return {
      success: true,
      statut: StatutSignalement.REJETE,
      message: 'Signalement rejeté avec motif enregistré.',
    };
  });

  // Détection de doublons candidats par calcul de distance géodésique (Support Split-View)
  fastify.get('/doublons-candidats/:id', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Détecter les doublons candidats par distance géodésique < 500m (UC02)',
      description: 'Recherche les signalements à proximité géographique pour affichage split-view et fusion sans suppression d auteurs.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();

    const target = await db.queryOne<{ latitude: number | null; longitude: number | null }>(
      `SELECT latitude, longitude FROM signalement WHERE id_signalement = $1`,
      [id]
    );

    if (!target) throw new NotFoundError('Signalement introuvable.');
    if (target.latitude == null || target.longitude == null) {
      return { success: true, count: 0, candidates: [] };
    }

    // Récupérer les signalements récents géolocalisés (exclus le signalement lui-même)
    const others = await db.query<{
      id_signalement: string;
      description: string;
      date_soumission: string;
      statut_signalement: string;
      latitude: number;
      longitude: number;
    }>(
      `SELECT id_signalement, description, date_soumission, statut_signalement, latitude, longitude
       FROM signalement
       WHERE id_signalement != $1 AND latitude IS NOT NULL AND longitude IS NOT NULL`
      , [id]
    );

    // Calculer la distance et filtrer les dépôts à moins de 500 mètres
    const candidates = others
      .map((s) => {
        const distanceMetres = calculateDistanceMeters(
          Number(target.latitude),
          Number(target.longitude),
          Number(s.latitude),
          Number(s.longitude)
        );
        return {
          idSignalement: s.id_signalement,
          description: s.description,
          dateSoumission: s.date_soumission,
          statutSignalement: s.statut_signalement,
          latitude: s.latitude,
          longitude: s.longitude,
          distanceMetres,
        };
      })
      .filter((s) => s.distanceMetres <= 500)
      .sort((a, b) => a.distanceMetres - b.distanceMetres);

    return { success: true, count: candidates.length, candidates };
  });
};
