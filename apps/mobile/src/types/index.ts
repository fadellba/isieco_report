import { RoleCode, StatutSignalement, StatutIntervention, ResultatIntervention } from '@isieco/shared';

export interface MobileUser {
  idUtilisateur: string;
  email: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  roles: RoleCode[];
}

export interface TypeDechetRef {
  idTypeDechet: string;
  codeType: string;
  libelle: string;
  description: string | null;
  niveauRisqueDefaut: string;
}

export interface SignalementDraft {
  description: string;
  latitude: number | null;
  longitude: number | null;
  precisionLocalisation: number | null;
  descriptionLocalisation: string | null;
  categories: Array<{
    idTypeDechet: string;
    quantiteEstimee?: string;
    volumeEstime?: string;
    remarque?: string;
  }>;
  photoUri?: string | null;
}

export interface SignalementItem {
  idSignalement: string;
  dateConstat: string | null;
  dateSoumission: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
  statutSignalement: StatutSignalement;
}

export interface MissionTerrainItem {
  idIntervention: string;
  statutIntervention: StatutIntervention;
  dateDebut: string | null;
  dateFin: string | null;
  idAffectation: string;
  idDossier: string;
  referenceDossier: string;
  descriptionSynthese: string;
  priorite: string;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
  codeTypeDechet: string;
  libelleDechet: string;
  nomEquipe: string;
}

export interface PointItem {
  idPoint: string;
  points: number;
  dateAttribution: string;
  motif: string;
  idSignalement: string | null;
}

export interface NotificationItem {
  idNotification: string;
  titre: string;
  message: string;
  lu: boolean;
  dateCreation: string;
  lienCible: string | null;
}

export interface OfflineActionMetadata {
  id: string;
  ownerId: string;
  timestamp: string;
}

export type OfflineAction =
  | (OfflineActionMetadata & {
      type: 'SIGNALEMENT_CREATION';
      payload: SignalementDraft & { idSignalementCree?: string };
    })
  | (OfflineActionMetadata & {
      type: 'INTERVENTION_TERMINER';
      payload: {
        idIntervention: string;
        data: {
          resultatIntervention: ResultatIntervention;
          compteRendu: string;
          motifException?: string;
        };
        photoUri?: string;
        photoReference?: string;
      };
    });

type OfflineActionInputFor<T> = T extends OfflineAction
  ? Omit<T, keyof OfflineActionMetadata>
  : never;
export type OfflineActionInput = OfflineActionInputFor<OfflineAction>;
