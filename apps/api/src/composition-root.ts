import { ApiDependencies } from './application/ports/api-dependencies.js';
import { PrismaAffectationsRepository } from './infrastructure/database/prisma-affectations.repository.js';
import { PrismaCarteStatsRepository } from './infrastructure/database/prisma-carte-stats.repository.js';
import { PrismaDossiersRepository } from './infrastructure/database/prisma-dossiers.repository.js';
import { PrismaDatabaseHealthCheck } from './infrastructure/database/prisma-database-health-check.js';
import { PrismaEvenementsRepository } from './infrastructure/database/prisma-evenements.repository.js';
import { PrismaIdentityRepository } from './infrastructure/database/prisma-identity.repository.js';
import { ScryptIdentitySecurity } from './infrastructure/security/scrypt-identity-security.js';
import { PrismaInterventionsRepository } from './infrastructure/database/prisma-interventions.repository.js';
import { PrismaNotificationsRepository } from './infrastructure/database/prisma-notifications.repository.js';
import { PrismaPointsRepository } from './infrastructure/database/prisma-points.repository.js';
import { PrismaPublicationsRepository } from './infrastructure/database/prisma-publications.repository.js';
import { LocalPublicationPhotoStorage } from './infrastructure/storage/publication-photo-storage.js';
import { PrismaQualificationRepository } from './infrastructure/database/prisma-qualification.repository.js';
import { PrismaReferentialsRepository } from './infrastructure/database/prisma-referentials.repository.js';
import { PrismaSignalementsRepository } from './infrastructure/database/prisma-signalements.repository.js';
import { PrismaTeamDelegationRepository } from './infrastructure/database/prisma-team-delegation.repository.js';
import { PrismaVerificationsRepository } from './infrastructure/database/prisma-verifications.repository.js';
import { getPrismaClient } from './infrastructure/database/prisma-client.js';
import { PrivateInterventionPhotoStorage } from './infrastructure/storage/private-intervention-photo-storage.js';
import { LocalSignalementPhotoStorage } from './infrastructure/storage/local-signalement-photo.storage.js';

export function createApiDependencies(): ApiDependencies {
  const prisma = getPrismaClient();

  return {
    affectations: new PrismaAffectationsRepository(prisma),
    carteStats: new PrismaCarteStatsRepository(prisma),
    databaseHealthCheck: new PrismaDatabaseHealthCheck(prisma),
    dossiers: new PrismaDossiersRepository(prisma),
    evenements: new PrismaEvenementsRepository(prisma),
    identity: new PrismaIdentityRepository(prisma),
    identitySecurity: new ScryptIdentitySecurity(),
    interventions: new PrismaInterventionsRepository(prisma),
    interventionPhotoStorage: new PrivateInterventionPhotoStorage(),
    notifications: new PrismaNotificationsRepository(prisma),
    points: new PrismaPointsRepository(prisma),
    publications: new PrismaPublicationsRepository(prisma),
    publicationPhotoStorage: new LocalPublicationPhotoStorage(),
    qualification: new PrismaQualificationRepository(prisma),
    referentials: new PrismaReferentialsRepository(prisma),
    signalements: new PrismaSignalementsRepository(prisma),
    signalementPhotoStorage: new LocalSignalementPhotoStorage(),
    teamDelegations: new PrismaTeamDelegationRepository(prisma),
    verifications: new PrismaVerificationsRepository(prisma),
  };
}
