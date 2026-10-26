import {
  TeamCompetence,
  TeamReference,
  WasteType,
} from '../../domain/referentials.js';

export type CreateTeamCompetence = {
  idEquipe: string;
  idTypeDechet: string;
  dateDebut: Date;
  dateFin: Date | null;
  commentaire: string;
  valideePar: string;
};

export type CreateWasteType = {
  codeType: string;
  libelle: string;
  description: string | null;
  orientationSpecialisee: boolean;
  dateDebutValidite: Date;
};

export type CreateTeam = {
  nomEquipe: string;
  description: string | null;
};

export type TeamMembershipFunction = 'AGENT_TERRAIN' | 'CHEF_EQUIPE' | 'CHEF_EQUIPE_TERRAIN';

export interface ReferentialsRepository {
  listActiveWasteTypes(at: Date): Promise<WasteType[]>;
  listActiveTeams(at: Date): Promise<TeamReference[]>;
  listActiveCompetences(at: Date, idTypeDechet?: string): Promise<TeamCompetence[]>;
  createCompetence(input: CreateTeamCompetence): Promise<string>;
  createWasteType(input: CreateWasteType): Promise<string>;
  archiveWasteType(idTypeDechet: string, at: Date): Promise<void>;
  reactivateWasteType(idTypeDechet: string, actorId: string, reason: string, at: Date): Promise<void>;
  createTeam(input: CreateTeam): Promise<string>;
  archiveTeam(idEquipe: string, at: Date): Promise<void>;
  reactivateTeam(idEquipe: string, actorId: string, reason: string, at: Date): Promise<void>;
  addTeamMember(input: {
    idEquipe: string;
    idUtilisateur: string;
    fonction: TeamMembershipFunction;
    dateDebut: Date;
  }): Promise<void>;
  endTeamMember(input: {
    idEquipe: string;
    idUtilisateur: string;
    at: Date;
  }): Promise<void>;
  archiveCompetence(idCompetenceEquipe: string, at: Date): Promise<void>;
}
