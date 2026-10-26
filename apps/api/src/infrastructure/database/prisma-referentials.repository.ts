import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  ReferentialRuleError,
  TeamCompetence,
  TeamReference,
  WasteType,
} from '../../domain/referentials.js';
import {
  CreateTeam,
  CreateTeamCompetence,
  CreateWasteType,
  ReferentialsRepository,
  TeamMembershipFunction,
} from '../../application/ports/referentials-repository.js';

export class PrismaReferentialsRepository implements ReferentialsRepository {
  constructor(private readonly client: PrismaClient) {}

  async listActiveWasteTypes(at: Date): Promise<WasteType[]> {
    return this.client.typeDechet.findMany({
      where: {
        dateDebutValidite: { lte: at },
        OR: [{ dateFinValidite: null }, { dateFinValidite: { gte: at } }],
      },
      orderBy: { libelle: 'asc' },
      select: {
        idTypeDechet: true,
        codeType: true,
        libelle: true,
        description: true,
        orientationSpecialisee: true,
        dateDebutValidite: true,
        dateFinValidite: true,
      },
    });
  }

  async listActiveTeams(at: Date): Promise<TeamReference[]> {
    const teams = await this.client.equipe.findMany({
      where: { etatEquipe: 'ACTIVE' },
      orderBy: { nomEquipe: 'asc' },
      select: {
        idEquipe: true,
        nomEquipe: true,
        description: true,
        etatEquipe: true,
        disponibiliteEquipe: {
          select: {
            etatDisponibilite: true,
            dateMiseAJour: true,
            valideJusqua: true,
            commentaire: true,
          },
        },
        appartenanceEquipe: {
          where: {
            dateDebut: { lte: at },
            OR: [{ dateFin: null }, { dateFin: { gte: at } }],
          },
          select: {
            fonction: true,
            utilisateur: {
              select: {
                idUtilisateur: true,
                nom: true,
                prenom: true,
              },
            },
          },
        },
        competenceEquipe: {
          where: {
            dateDebut: { lte: at },
            OR: [{ dateFin: null }, { dateFin: { gte: at } }],
            typeDechet: {
              dateDebutValidite: { lte: at },
              OR: [{ dateFinValidite: null }, { dateFinValidite: { gte: at } }],
            },
          },
          select: {
            idCompetenceEquipe: true,
            dateDebut: true,
            dateFin: true,
            typeDechet: {
              select: {
                idTypeDechet: true,
                codeType: true,
                libelle: true,
              },
            },
          },
        },
      },
    });

    return teams.map((team) => ({
      idEquipe: team.idEquipe,
      nomEquipe: team.nomEquipe,
      description: team.description,
      etatEquipe: team.etatEquipe,
      disponibilite: {
        etat: team.disponibiliteEquipe
          ? team.disponibiliteEquipe.valideJusqua >= at
            ? team.disponibiliteEquipe.etatDisponibilite as 'DISPONIBLE' | 'INDISPONIBLE'
            : 'INCONNUE'
          : 'INCONNUE',
        dateMiseAJour: team.disponibiliteEquipe?.dateMiseAJour ?? null,
        valideJusqua: team.disponibiliteEquipe?.valideJusqua ?? null,
        commentaire: team.disponibiliteEquipe?.commentaire ?? null,
      },
      membres: team.appartenanceEquipe.map((membership) => ({
        idUtilisateur: membership.utilisateur.idUtilisateur,
        nom: membership.utilisateur.nom,
        prenom: membership.utilisateur.prenom,
        fonction: membership.fonction,
      })),
      competences: team.competenceEquipe.map((competence) => ({
        idCompetenceEquipe: competence.idCompetenceEquipe,
        idTypeDechet: competence.typeDechet.idTypeDechet,
        codeType: competence.typeDechet.codeType,
        libelleDechet: competence.typeDechet.libelle,
        dateDebut: competence.dateDebut,
        dateFin: competence.dateFin,
      })),
    }));
  }

  async listActiveCompetences(at: Date, idTypeDechet?: string): Promise<TeamCompetence[]> {
    const competences = await this.client.competenceEquipe.findMany({
      where: {
        equipe: { etatEquipe: 'ACTIVE' },
        dateDebut: { lte: at },
        OR: [{ dateFin: null }, { dateFin: { gte: at } }],
        typeDechet: {
          dateDebutValidite: { lte: at },
          OR: [{ dateFinValidite: null }, { dateFinValidite: { gte: at } }],
        },
        ...(idTypeDechet ? { idTypeDechet } : {}),
      },
      orderBy: { equipe: { nomEquipe: 'asc' } },
      select: {
        idCompetenceEquipe: true,
        idEquipe: true,
        idTypeDechet: true,
        dateDebut: true,
        dateFin: true,
        equipe: { select: { nomEquipe: true } },
        typeDechet: {
          select: {
            codeType: true,
            libelle: true,
          },
        },
      },
    });

    return competences.map((competence) => ({
      idCompetenceEquipe: competence.idCompetenceEquipe,
      idEquipe: competence.idEquipe,
      nomEquipe: competence.equipe.nomEquipe,
      idTypeDechet: competence.idTypeDechet,
      codeType: competence.typeDechet.codeType,
      libelleDechet: competence.typeDechet.libelle,
      dateDebut: competence.dateDebut,
      dateFin: competence.dateFin,
    }));
  }

  async createCompetence(input: CreateTeamCompetence): Promise<string> {
    try {
      const [team, wasteType] = await Promise.all([
        this.client.equipe.findUnique({
          where: { idEquipe: input.idEquipe },
          select: { etatEquipe: true },
        }),
        this.client.typeDechet.findUnique({
          where: { idTypeDechet: input.idTypeDechet },
          select: { dateDebutValidite: true, dateFinValidite: true },
        }),
      ]);
      if (!team) throw new ReferentialRuleError('TEAM_NOT_FOUND');
      if (team.etatEquipe !== 'ACTIVE') throw new ReferentialRuleError('TEAM_NOT_ACTIVE');
      if (!wasteType) throw new ReferentialRuleError('WASTE_TYPE_NOT_FOUND');
      if (
        wasteType.dateDebutValidite > input.dateDebut ||
        (wasteType.dateFinValidite && wasteType.dateFinValidite < input.dateDebut)
      ) {
        throw new ReferentialRuleError('WASTE_TYPE_NOT_FOUND');
      }

      const competence = await this.client.competenceEquipe.create({
        data: {
          idEquipe: input.idEquipe,
          idTypeDechet: input.idTypeDechet,
          dateDebut: input.dateDebut,
          dateFin: input.dateFin,
          commentaire: input.commentaire,
          valideePar: input.valideePar,
        },
        select: { idCompetenceEquipe: true },
      });
      return competence.idCompetenceEquipe;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ReferentialRuleError('COMPETENCE_ALREADY_EXISTS');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        const teamExists = await this.client.equipe.findUnique({
          where: { idEquipe: input.idEquipe },
          select: { idEquipe: true },
        });
        if (!teamExists) {
          throw new ReferentialRuleError('TEAM_NOT_FOUND');
        }
        throw new ReferentialRuleError('WASTE_TYPE_NOT_FOUND');
      }

      throw error;
    }
  }

  async createWasteType(input: CreateWasteType): Promise<string> {
    try {
      const wasteType = await this.client.typeDechet.create({
        data: input,
        select: { idTypeDechet: true },
      });
      return wasteType.idTypeDechet;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ReferentialRuleError('WASTE_TYPE_CODE_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async archiveWasteType(idTypeDechet: string, at: Date): Promise<void> {
    const wasteType = await this.client.typeDechet.findUnique({
      where: { idTypeDechet },
      select: { dateFinValidite: true },
    });
    if (!wasteType) throw new ReferentialRuleError('WASTE_TYPE_NOT_FOUND');
    if (wasteType.dateFinValidite) return;

    await this.client.typeDechet.update({
      where: { idTypeDechet },
      data: { dateFinValidite: at },
    });
  }

  async reactivateWasteType(
    idTypeDechet: string,
    actorId: string,
    reason: string,
    at: Date,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const type = await transaction.typeDechet.findUnique({
        where: { idTypeDechet },
        select: { dateFinValidite: true, codeType: true },
      });
      if (!type) throw new ReferentialRuleError('WASTE_TYPE_NOT_FOUND');
      if (!type.dateFinValidite) throw new ReferentialRuleError('WASTE_TYPE_ALREADY_ACTIVE');

      await transaction.typeDechet.update({
        where: { idTypeDechet },
        data: { dateFinValidite: null },
      });
      await transaction.evenementMetier.create({
        data: {
          typeEvenement: 'TYPE_DECHET_REACTIVE',
          origine: 'PORTAIL_GESTION',
          idActeur: actorId,
          idTypeDechetCible: idTypeDechet,
          dateEvenement: at,
          donneesAvant: { dateFinValidite: type.dateFinValidite.toISOString() },
          donneesApres: { dateFinValidite: null, codeType: type.codeType },
          motif: reason,
        },
      });
    });
  }

  async createTeam(input: CreateTeam): Promise<string> {
    const team = await this.client.equipe.create({
      data: input,
      select: { idEquipe: true },
    });
    return team.idEquipe;
  }

  async archiveTeam(idEquipe: string, at: Date): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const team = await transaction.equipe.findUnique({
        where: { idEquipe },
        select: { etatEquipe: true },
      });
      if (!team) throw new ReferentialRuleError('TEAM_NOT_FOUND');
      if (team.etatEquipe === 'DISSOUTE') return;

      const activeAssignments = await transaction.affectation.count({
        where: { idEquipe, etatAffectation: { in: ['ACTIVE', 'A_VERIFIER'] } },
      });
      if (activeAssignments > 0) {
        throw new ReferentialRuleError('TEAM_HAS_ACTIVE_ASSIGNMENTS');
      }

      await transaction.delegationDecisionEquipe.updateMany({
        where: {
          idEquipe,
          dateDebut: { lte: at },
          OR: [{ dateFin: null }, { dateFin: { gte: at } }],
        },
        data: { dateFin: at },
      });
      await transaction.appartenanceEquipe.updateMany({
        where: {
          idEquipe,
          dateDebut: { lte: at },
          OR: [{ dateFin: null }, { dateFin: { gte: at } }],
        },
        data: { dateFin: at },
      });
      await transaction.equipe.update({
        where: { idEquipe },
        data: { etatEquipe: 'DISSOUTE' },
      });
    });
  }

  async reactivateTeam(
    idEquipe: string,
    actorId: string,
    reason: string,
    at: Date,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const team = await transaction.equipe.findUnique({
        where: { idEquipe },
        select: { etatEquipe: true, nomEquipe: true },
      });
      if (!team) throw new ReferentialRuleError('TEAM_NOT_FOUND');
      if (team.etatEquipe === 'ACTIVE') throw new ReferentialRuleError('TEAM_ALREADY_ACTIVE');

      await transaction.equipe.update({
        where: { idEquipe },
        data: { etatEquipe: 'ACTIVE' },
      });
      await transaction.evenementMetier.create({
        data: {
          typeEvenement: 'EQUIPE_REACTIVE',
          origine: 'PORTAIL_GESTION',
          idActeur: actorId,
          idEquipeCible: idEquipe,
          dateEvenement: at,
          donneesAvant: { etatEquipe: team.etatEquipe },
          donneesApres: { etatEquipe: 'ACTIVE', nomEquipe: team.nomEquipe },
          motif: reason,
        },
      });
    });
  }

  async addTeamMember(input: {
    idEquipe: string;
    idUtilisateur: string;
    fonction: TeamMembershipFunction;
    dateDebut: Date;
  }): Promise<void> {
    const team = await this.client.equipe.findUnique({
      where: { idEquipe: input.idEquipe },
      select: { etatEquipe: true },
    });
    if (!team) throw new ReferentialRuleError('TEAM_NOT_FOUND');
    if (team.etatEquipe !== 'ACTIVE') throw new ReferentialRuleError('TEAM_NOT_ACTIVE');

    const user = await this.client.utilisateur.findUnique({
      where: { idUtilisateur: input.idUtilisateur },
      select: { etatCompte: true },
    });
    if (!user) throw new ReferentialRuleError('USER_NOT_FOUND');
    if (user.etatCompte !== 'ACTIF') throw new ReferentialRuleError('USER_NOT_ACTIVE');

    const fieldRole = await this.client.utilisateurRole.findFirst({
      where: {
        idUtilisateur: input.idUtilisateur,
        dateDebut: { lte: input.dateDebut },
        OR: [{ dateFin: null }, { dateFin: { gte: input.dateDebut } }],
        role: { codeRole: 'TERRAIN' },
      },
      select: { idRole: true },
    });
    if (!fieldRole) throw new ReferentialRuleError('USER_MUST_HAVE_TERRAIN_ROLE');

    const existing = await this.client.appartenanceEquipe.findFirst({
      where: {
        idUtilisateur: input.idUtilisateur,
        idEquipe: input.idEquipe,
        dateDebut: { lte: input.dateDebut },
        OR: [{ dateFin: null }, { dateFin: { gte: input.dateDebut } }],
      },
      select: { idUtilisateur: true },
    });
    if (existing) throw new ReferentialRuleError('MEMBERSHIP_ALREADY_ACTIVE');

    try {
      await this.client.appartenanceEquipe.create({
        data: {
          idUtilisateur: input.idUtilisateur,
          idEquipe: input.idEquipe,
          dateDebut: input.dateDebut,
          fonction: input.fonction,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ReferentialRuleError('MEMBERSHIP_ALREADY_ACTIVE');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ReferentialRuleError('USER_NOT_FOUND');
      }
      throw error;
    }
  }

  async endTeamMember(input: { idEquipe: string; idUtilisateur: string; at: Date }): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const membership = await transaction.appartenanceEquipe.findFirst({
        where: {
          idEquipe: input.idEquipe,
          idUtilisateur: input.idUtilisateur,
          dateDebut: { lte: input.at },
          OR: [{ dateFin: null }, { dateFin: { gte: input.at } }],
        },
        orderBy: { dateDebut: 'desc' },
        select: { dateDebut: true },
      });
      if (!membership) throw new ReferentialRuleError('MEMBERSHIP_NOT_FOUND');

      await transaction.delegationDecisionEquipe.updateMany({
        where: {
          idEquipe: input.idEquipe,
          idUtilisateurDelegue: input.idUtilisateur,
          dateDebutAppartenance: membership.dateDebut,
          dateDebut: { lte: input.at },
          OR: [{ dateFin: null }, { dateFin: { gte: input.at } }],
        },
        data: { dateFin: input.at },
      });
      await transaction.appartenanceEquipe.update({
        where: {
          idUtilisateur_idEquipe_dateDebut: {
            idUtilisateur: input.idUtilisateur,
            idEquipe: input.idEquipe,
            dateDebut: membership.dateDebut,
          },
        },
        data: { dateFin: input.at },
      });
    });
  }

  async archiveCompetence(idCompetenceEquipe: string, at: Date): Promise<void> {
    const competence = await this.client.competenceEquipe.findUnique({
      where: { idCompetenceEquipe },
      select: { dateDebut: true, dateFin: true },
    });
    if (!competence) throw new ReferentialRuleError('COMPETENCE_NOT_FOUND');
    if (competence.dateFin) return;
    if (competence.dateDebut > at) {
      throw new ReferentialRuleError('COMPETENCE_NOT_STARTED');
    }

    await this.client.competenceEquipe.update({
      where: { idCompetenceEquipe },
      data: { dateFin: at },
    });
  }
}
