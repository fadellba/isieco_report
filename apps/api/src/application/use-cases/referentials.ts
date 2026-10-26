import {
  CreateTeam,
  CreateTeamCompetence,
  CreateWasteType,
  ReferentialsRepository,
  TeamMembershipFunction,
} from '../ports/referentials-repository.js';
import {
  ReferentialRuleError,
  TeamCompetence,
  TeamReference,
  WasteType,
} from '../../domain/referentials.js';

export async function listActiveWasteTypes(
  repository: ReferentialsRepository,
  at = new Date(),
): Promise<WasteType[]> {
  return repository.listActiveWasteTypes(at);
}

export async function listActiveTeams(
  repository: ReferentialsRepository,
  at = new Date(),
): Promise<TeamReference[]> {
  return repository.listActiveTeams(at);
}

export async function listActiveCompetences(
  repository: ReferentialsRepository,
  at = new Date(),
  idTypeDechet?: string,
): Promise<TeamCompetence[]> {
  return repository.listActiveCompetences(at, idTypeDechet);
}

export async function createTeamCompetence(
  repository: ReferentialsRepository,
  input: CreateTeamCompetence,
): Promise<string> {
  if (input.dateFin && input.dateFin < input.dateDebut) {
    throw new ReferentialRuleError('INVALID_COMPETENCE_PERIOD');
  }

  return repository.createCompetence(input);
}

export function createWasteType(
  repository: ReferentialsRepository,
  input: Omit<CreateWasteType, 'dateDebutValidite'>,
): Promise<string> {
  return repository.createWasteType({
    ...input,
    codeType: input.codeType.trim().toUpperCase(),
    libelle: input.libelle.trim(),
    description: input.description?.trim() || null,
    dateDebutValidite: new Date(),
  });
}

export function archiveWasteType(
  repository: ReferentialsRepository,
  idTypeDechet: string,
  at = new Date(),
): Promise<void> {
  return repository.archiveWasteType(idTypeDechet, at);
}

export function reactivateWasteType(
  repository: ReferentialsRepository,
  idTypeDechet: string,
  actorId: string,
  reason: string,
  at = new Date(),
): Promise<void> {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 10) {
    throw new ReferentialRuleError('INVALID_REACTIVATION_REASON');
  }
  return repository.reactivateWasteType(idTypeDechet, actorId, normalizedReason, at);
}

export function createTeam(
  repository: ReferentialsRepository,
  input: CreateTeam,
): Promise<string> {
  return repository.createTeam({
    nomEquipe: input.nomEquipe.trim(),
    description: input.description?.trim() || null,
  });
}

export function archiveTeam(
  repository: ReferentialsRepository,
  idEquipe: string,
  at = new Date(),
): Promise<void> {
  return repository.archiveTeam(idEquipe, at);
}

export function reactivateTeam(
  repository: ReferentialsRepository,
  idEquipe: string,
  actorId: string,
  reason: string,
  at = new Date(),
): Promise<void> {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 10) {
    throw new ReferentialRuleError('INVALID_REACTIVATION_REASON');
  }
  return repository.reactivateTeam(idEquipe, actorId, normalizedReason, at);
}

export function addTeamMember(
  repository: ReferentialsRepository,
  input: {
    idEquipe: string;
    idUtilisateur: string;
    fonction: TeamMembershipFunction;
  },
  at = new Date(),
): Promise<void> {
  return repository.addTeamMember({ ...input, dateDebut: at });
}

export function endTeamMember(
  repository: ReferentialsRepository,
  input: { idEquipe: string; idUtilisateur: string },
  at = new Date(),
): Promise<void> {
  return repository.endTeamMember({ ...input, at });
}

export function archiveTeamCompetence(
  repository: ReferentialsRepository,
  idCompetenceEquipe: string,
  at = new Date(),
): Promise<void> {
  return repository.archiveCompetence(idCompetenceEquipe, at);
}
