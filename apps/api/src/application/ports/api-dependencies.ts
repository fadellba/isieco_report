import { AffectationsRepository } from './affectations-repository.js';
import { CarteStatsRepository } from './carte-stats-repository.js';
import { DatabaseHealthCheck } from './database-health-check.js';
import { DossiersRepository } from './dossiers-repository.js';
import { EvenementsRepository } from './evenements-repository.js';
import { IdentityRepository } from './identity-repository.js';
import { IdentitySecurity } from './identity-security.js';
import { InterventionsRepository, InterventionPhotoStorage } from './interventions-repository.js';
import { NotificationsRepository } from './notifications-repository.js';
import { PointsRepository } from './points-repository.js';
import { PublicationPhotoStorage, PublicationsRepository } from './publications-repository.js';
import { QualificationRepository } from './qualification-repository.js';
import { ReferentialsRepository } from './referentials-repository.js';
import { SignalementPhotoStorage, SignalementsRepository } from './signalements-repository.js';
import { TeamDelegationRepository } from './team-delegation-repository.js';
import { VerificationsRepository } from './verifications-repository.js';

export interface ApiDependencies {
  affectations: AffectationsRepository;
  carteStats: CarteStatsRepository;
  databaseHealthCheck: DatabaseHealthCheck;
  dossiers: DossiersRepository;
  evenements: EvenementsRepository;
  identity: IdentityRepository;
  identitySecurity: IdentitySecurity;
  interventions: InterventionsRepository;
  interventionPhotoStorage: InterventionPhotoStorage;
  notifications: NotificationsRepository;
  points: PointsRepository;
  publications: PublicationsRepository;
  publicationPhotoStorage: PublicationPhotoStorage;
  qualification: QualificationRepository;
  referentials: ReferentialsRepository;
  signalements: SignalementsRepository;
  signalementPhotoStorage: SignalementPhotoStorage;
  teamDelegations: TeamDelegationRepository;
  verifications: VerificationsRepository;
}
