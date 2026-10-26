export type WasteType = {
  idTypeDechet: string;
  codeType: string;
  libelle: string;
  description: string | null;
  orientationSpecialisee: boolean;
  dateDebutValidite: Date;
  dateFinValidite: Date | null;
};

export type TeamReference = {
  idEquipe: string;
  nomEquipe: string;
  description: string | null;
  etatEquipe: string;
  disponibilite: {
    etat: 'DISPONIBLE' | 'INDISPONIBLE' | 'INCONNUE';
    dateMiseAJour: Date | null;
    valideJusqua: Date | null;
    commentaire: string | null;
  };
  membres: Array<{
    idUtilisateur: string;
    nom: string;
    prenom: string | null;
    fonction: string;
  }>;
  competences: Array<{
    idCompetenceEquipe: string;
    idTypeDechet: string;
    codeType: string;
    libelleDechet: string;
    dateDebut: Date;
    dateFin: Date | null;
  }>;
};

export type TeamCompetence = {
  idCompetenceEquipe: string;
  idEquipe: string;
  nomEquipe: string;
  idTypeDechet: string;
  codeType: string;
  libelleDechet: string;
  dateDebut: Date;
  dateFin: Date | null;
};

export class ReferentialRuleError extends Error {
  constructor(
    readonly rule:
      | 'INVALID_COMPETENCE_PERIOD'
      | 'TEAM_NOT_FOUND'
      | 'WASTE_TYPE_NOT_FOUND'
      | 'USER_NOT_FOUND'
      | 'USER_NOT_ACTIVE'
      | 'USER_MUST_HAVE_TERRAIN_ROLE'
      | 'TEAM_NOT_ACTIVE'
      | 'MEMBERSHIP_NOT_FOUND'
      | 'MEMBERSHIP_ALREADY_ACTIVE'
      | 'COMPETENCE_NOT_FOUND'
      | 'COMPETENCE_NOT_STARTED'
      | 'TEAM_HAS_ACTIVE_ASSIGNMENTS'
      | 'WASTE_TYPE_CODE_ALREADY_EXISTS'
      | 'COMPETENCE_ALREADY_EXISTS'
      | 'WASTE_TYPE_ALREADY_ACTIVE'
      | 'TEAM_ALREADY_ACTIVE'
      | 'INVALID_REACTIVATION_REASON'
  ) {
    super(rule);
    this.name = 'ReferentialRuleError';
  }
}
