import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';
import { getDb } from '../index.js';

const CITIZEN_ID = '00000000-0000-0000-0000-000000000001';
const SEED_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_DIRECTORY = path.join(SEED_DIRECTORY, 'assets');

const demonstrations = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    description: 'Dépôt de sacs plastiques et bouteilles abandonnés près du marché Sandaga.',
    latitude: 14.6761,
    longitude: -17.4358,
    location: 'Marché Sandaga, Dakar-Plateau',
    status: 'SOUMIS',
    categoryId: '10000000-0000-0000-0000-000000000001',
    quantity: '8 sacs',
    volume: '1 m³',
    photoId: '60000000-0000-0000-0000-000000000001',
    photoFile: 'plastic-waste-street.jpg',
    photoDescription: 'Photo d’illustration — déchets plastiques en milieu urbain.',
    minutesAgo: 38,
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    description: 'Encombrants et déchets mélangés sur le trottoir, passage piéton partiellement bloqué.',
    latitude: 14.6811,
    longitude: -17.4451,
    location: 'Marché Tilène, Médina',
    status: 'SOUMIS',
    categoryId: '10000000-0000-0000-0000-000000000004',
    quantity: '1 dépôt',
    volume: '2 m³',
    photoId: '60000000-0000-0000-0000-000000000002',
    photoFile: 'waste-plastic-bottles.jpg',
    photoDescription: 'Photo d’illustration — collecte de déchets.',
    minutesAgo: 96,
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    description: 'Déchets organiques et emballages près des étals après le marché.',
    latitude: 14.6799,
    longitude: -17.4402,
    location: 'Avenue Blaise Diagne, Médina',
    status: 'EN_COURS_DE_QUALIFICATION',
    categoryId: '10000000-0000-0000-0000-000000000002',
    quantity: '6 sacs',
    volume: '0,7 m³',
    photoId: '60000000-0000-0000-0000-000000000003',
    photoFile: 'plastic-waste-street.jpg',
    photoDescription: 'Photo d’illustration — zone de déchets à ciel ouvert.',
    minutesAgo: 205,
  },
] as const;

async function seedDemoData() {
  const db = getDb();
  const uploadDirectory = path.resolve(config.uploadDir);
  await mkdir(uploadDirectory, { recursive: true });

  for (const report of demonstrations) {
    await copyFile(path.join(PHOTO_DIRECTORY, report.photoFile), path.join(uploadDirectory, `${report.photoId}.jpg`));
  }

  const submittedAt = new Date();
  await db.transaction(async (transaction) => {
    for (const report of demonstrations) {
      const reportDate = new Date(submittedAt.getTime() - report.minutesAgo * 60_000).toISOString();
      await transaction.execute(
        `INSERT INTO signalement (
          id_signalement, id_utilisateur, date_constat, date_soumission, description,
          latitude, longitude, description_localisation, statut_signalement
        ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id_signalement) DO NOTHING`,
        [
          report.id,
          CITIZEN_ID,
          reportDate,
          report.description,
          report.latitude,
          report.longitude,
          report.location,
          report.status,
        ]
      );
      await transaction.execute(
        `INSERT INTO contenu_signalement (
          id_signalement, id_type_dechet, quantite_estimee, volume_estime, remarque
        ) VALUES ($1, $2, $3, $4, 'Donnée de démonstration locale')
        ON CONFLICT (id_signalement, id_type_dechet) DO NOTHING`,
        [report.id, report.categoryId, report.quantity, report.volume]
      );
      await transaction.execute(
        `INSERT INTO photo_signalement (
          id_photo_signalement, id_signalement, reference_photo, description, date_ajout
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id_photo_signalement) DO NOTHING`,
        [report.photoId, report.id, `${report.photoId}.jpg`, report.photoDescription, reportDate]
      );
    }
  });

  await db.close();
  console.log(`Jeu de démonstration installé : ${demonstrations.length} signalements et leurs photos.`);
}

seedDemoData().catch((error: unknown) => {
  console.error('Échec du chargement des données de démonstration.', error);
  process.exitCode = 1;
});
