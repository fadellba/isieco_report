import { CarteStatsRepository } from '../ports/carte-stats-repository.js';

export async function getMapPoints(repository: CarteStatsRepository) {
  const { cases, reports, interventions, nonGeolocatedReports } = await repository.getMapData();

  const points = [
    ...cases.map((item) => ({
      id: item.id,
      typeObjet: 'DOSSIER' as const,
      reference: item.reference,
      description: item.description,
      priorite: item.priority,
      statut: item.status,
      latitude: item.latitude,
      longitude: item.longitude,
      dateCreation: item.createdAt,
      idAffectation: null,
      referenceDossier: null,
      nomEquipe: null,
      dateDebut: null,
      dateFin: null,
      resultatIntervention: null,
    })),
    ...reports.map((item) => ({
      id: item.id,
      typeObjet: 'SIGNALEMENT' as const,
      reference: `SIG-${item.id.slice(0, 8)}-${item.id.slice(-4)}`,
      description: item.description,
      priorite: 'MOYENNE',
      statut: item.status,
      latitude: item.latitude,
      longitude: item.longitude,
      dateCreation: item.submittedAt,
      idAffectation: null,
      referenceDossier: null,
      nomEquipe: null,
      dateDebut: null,
      dateFin: null,
      resultatIntervention: null,
    })),
    ...interventions.map((item) => ({
      id: item.id,
      typeObjet: 'INTERVENTION' as const,
      reference: `INT-${item.id.slice(0, 8)}`,
      description: item.caseDescription,
      priorite: item.casePriority,
      statut: item.status,
      latitude: item.latitude,
      longitude: item.longitude,
      dateCreation: item.startedAt ?? item.assignedAt,
      idAffectation: item.assignmentId,
      referenceDossier: item.caseReference,
      nomEquipe: item.teamName,
      dateDebut: item.startedAt,
      dateFin: item.endedAt,
      resultatIntervention: item.result,
    })),
  ];
  const sansCoordonnees = nonGeolocatedReports.map((item) => ({
    idSignalement: item.id,
    description: item.description,
    descriptionLocalisation: item.locationDescription,
    statutSignalement: item.status,
    dateSoumission: item.submittedAt,
  }));

  return {
    success: true,
    pointsGeolocalises: points,
    totalPoints: points.length,
    sansCoordonnees,
    totalSansCoordonnees: sansCoordonnees.length,
  };
}

export async function getSanitationIndicators(repository: CarteStatsRepository) {
  const [
    observationsRecues,
    dossiersCrees,
    dossiersCloturesResolus,
    affectationsAttribuees,
    interventionsTerminees,
    resolutionsVerifieesConformes,
    reouverturesTracees,
  ] = await Promise.all([
    repository.countReports(),
    repository.countCases(),
    repository.countResolvedCases(),
    repository.countAssignments(),
    repository.countCompletedInterventions(),
    repository.countVerifiedResolutions(),
    repository.countReopenings(),
  ]);

  return {
    success: true,
    indicateurs: {
      observationsRecues,
      dossiersCrees,
      dossiersCloturesResolus,
      tauxResolutionGlobalPct: dossiersCrees > 0
        ? Math.round((dossiersCloturesResolus / dossiersCrees) * 100)
        : 0,
      affectationsAttribuees,
      interventionsTerminees,
      resolutionsVerifieesConformes,
      reouverturesTracees,
    },
    definitions: {
      periode: 'Cumul depuis la création des données ; aucune fenêtre temporelle ni exclusion de date appliquée.',
      observationsRecues: 'Nombre total de signalements enregistrés, tous statuts confondus.',
      dossiersCrees: 'Nombre total de dossiers opérationnels enregistrés, tous statuts confondus.',
      dossiersCloturesResolus: 'Nombre de dossiers dont le statut courant est CLOS_RESOLUTION_CONFIRMEE.',
      tauxResolutionGlobalPct: 'Dossiers actuellement clôturés avec résolution confirmée / dossiers créés, arrondi à l’entier ; 0 si aucun dossier.',
      affectationsAttribuees: 'Nombre total de lignes d’affectation, y compris terminées, remplacées et annulées.',
      interventionsTerminees: 'Nombre total d’interventions au statut TERMINEE, résultats confondus.',
      resolutionsVerifieesConformes: 'Nombre de vérifications enregistrées au résultat CONFORME_RESOLU, y compris les vérifications remplacées.',
      reouverturesTracees: 'Nombre total d’événements DOSSIER_REOUVERT.',
      rg58: 'Les observations reçues et les dossiers créés sont des populations distinctes ; aucune mesure n’est assimilée à une autre.',
      rg59: 'Résolutions vérifiées, clôtures courantes, interventions terminées et réouvertures sont comptées séparément.',
    },
  };
}
