import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { RoleCode } from '@isieco/shared';
import {
  AuthenticatedSession,
  IdentityRepository,
  IdentityUser,
  LoginAccount,
} from '../../application/ports/identity-repository.js';

function activeRoleFilter() {
  return { OR: [{ dateFin: null }, { dateFin: { gte: new Date() } }] };
}

function mapIdentityUser(user: {
  idUtilisateur: string;
  nom: string;
  prenom: string | null;
  email: string;
  telephone: string | null;
  etatCompte: string;
  dateInscription: Date;
  utilisateurRoleUtilisateurRoleIdUtilisateurToutilisateur: Array<{
    role: { codeRole: string };
  }>;
}): IdentityUser {
  return {
    idUtilisateur: user.idUtilisateur,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    telephone: user.telephone,
    etatCompte: user.etatCompte,
    dateInscription: user.dateInscription,
    roles: user.utilisateurRoleUtilisateurRoleIdUtilisateurToutilisateur
      .map((userRole) => userRole.role.codeRole as RoleCode),
  };
}

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly client: PrismaClient) {}

  async findLoginAccount(email: string): Promise<LoginAccount | null> {
    const user = await this.client.utilisateur.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        utilisateurRoleUtilisateurRoleIdUtilisateurToutilisateur: {
          where: activeRoleFilter(),
          include: { role: { select: { codeRole: true } } },
        },
      },
    });
    if (!user) return null;
    return { ...mapIdentityUser(user), motDePasseHash: user.motDePasseHash };
  }

  async createSession(input: {
    idUtilisateur: string;
    tokenHash: string;
    clientType: string;
    dateExpiration: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<string> {
    const session = await this.client.session.create({
      data: {
        idUtilisateur: input.idUtilisateur,
        token: input.tokenHash,
        clientType: input.clientType,
        dateExpiration: input.dateExpiration,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      select: { idSession: true },
    });
    return session.idSession;
  }

  async findAuthenticatedSession(tokenHash: string): Promise<AuthenticatedSession | null> {
    const session = await this.client.session.findFirst({
      where: { token: tokenHash, estActif: true },
      include: {
        utilisateur: {
          include: {
            utilisateurRoleUtilisateurRoleIdUtilisateurToutilisateur: {
              where: activeRoleFilter(),
              include: { role: { select: { codeRole: true } } },
            },
          },
        },
      },
    });
    if (!session) return null;
    return {
      idSession: session.idSession,
      clientType: session.clientType,
      dateExpiration: session.dateExpiration,
      user: mapIdentityUser(session.utilisateur),
    };
  }

  async revokeSession(idSession: string): Promise<void> {
    await this.client.session.updateMany({
      where: { idSession },
      data: { estActif: false },
    });
  }

  async findUser(idUtilisateur: string): Promise<IdentityUser | null> {
    const user = await this.client.utilisateur.findUnique({
      where: { idUtilisateur },
      include: {
        utilisateurRoleUtilisateurRoleIdUtilisateurToutilisateur: {
          where: activeRoleFilter(),
          include: { role: { select: { codeRole: true } } },
        },
      },
    });
    return user ? mapIdentityUser(user) : null;
  }

  async findPasswordHash(idUtilisateur: string): Promise<string | null> {
    const user = await this.client.utilisateur.findUnique({
      where: { idUtilisateur },
      select: { motDePasseHash: true },
    });
    return user?.motDePasseHash ?? null;
  }

  async updateProfileAndAudit(input: {
    idUtilisateur: string;
    nom: string;
    prenom: string | null;
    telephone: string | null;
  }): Promise<boolean> {
    const { idUtilisateur, nom, prenom, telephone } = input;
    return this.client.$transaction(async (transaction) => {
      const before = await transaction.utilisateur.findUnique({
        where: { idUtilisateur },
        select: { nom: true, prenom: true, telephone: true },
      });
      if (!before) return false;

      await transaction.utilisateur.update({
        where: { idUtilisateur },
        data: { nom, prenom, telephone },
      });
      await transaction.evenementMetier.create({
        data: {
          typeEvenement: 'COMPTE_MODIFIE',
          origine: 'PORTAIL_GESTION',
          idActeur: idUtilisateur,
          idUtilisateurCible: idUtilisateur,
          donneesAvant: before,
          donneesApres: { nom, prenom, telephone },
          motif: 'Mise à jour du profil personnel',
        },
      });
      return true;
    });
  }

  async changePasswordAndRevokeOtherSessions(input: {
    idUtilisateur: string;
    currentSessionId: string;
    passwordHash: string;
  }): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.utilisateur.update({
        where: { idUtilisateur: input.idUtilisateur },
        data: { motDePasseHash: input.passwordHash },
      });
      await transaction.session.updateMany({
        where: {
          idUtilisateur: input.idUtilisateur,
          idSession: { not: input.currentSessionId },
          estActif: true,
        },
        data: { estActif: false },
      });
      await transaction.evenementMetier.create({
        data: {
          typeEvenement: 'COMPTE_MODIFIE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.idUtilisateur,
          idUtilisateurCible: input.idUtilisateur,
          donneesApres: { motDePasseModifie: true },
          motif: 'Changement du mot de passe personnel',
        },
      });
    });
  }

  async listUsers(): Promise<IdentityUser[]> {
    const users = await this.client.utilisateur.findMany({
      orderBy: { nom: 'asc' },
      include: {
        utilisateurRoleUtilisateurRoleIdUtilisateurToutilisateur: {
          where: activeRoleFilter(),
          include: { role: { select: { codeRole: true } } },
        },
      },
    });
    return users.map(mapIdentityUser);
  }

  async updateAccountStatusAndAudit(input: {
    idUtilisateur: string;
    actorId: string;
    etatCompte: string;
    motif: string | null;
  }): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      const user = await transaction.utilisateur.findUnique({
        where: { idUtilisateur: input.idUtilisateur },
        select: { idUtilisateur: true, etatCompte: true },
      });
      if (!user) return false;

      await transaction.utilisateur.update({
        where: { idUtilisateur: input.idUtilisateur },
        data: { etatCompte: input.etatCompte },
      });
      if (input.etatCompte !== 'ACTIF') {
        await transaction.session.updateMany({
          where: { idUtilisateur: input.idUtilisateur, estActif: true },
          data: { estActif: false },
        });
      }
      await transaction.evenementMetier.create({
        data: {
          typeEvenement: input.etatCompte === 'INACTIF' ? 'COMPTE_DESACTIVE' : 'COMPTE_MODIFIE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.actorId,
          idUtilisateurCible: input.idUtilisateur,
          donneesAvant: { etatCompte: user.etatCompte },
          donneesApres: { etatCompte: input.etatCompte },
          motif: input.motif || "Modification de l'état du compte par l'administrateur",
        },
      });
      return true;
    });
  }

  async assignRoleAndAudit(input: {
    idUtilisateur: string;
    actorId: string;
    codeRole: string;
    motif: string | null;
  }): Promise<'USER_NOT_FOUND' | 'ROLE_NOT_FOUND' | void> {
    return this.client.$transaction(async (transaction) => {
      const [user, role] = await Promise.all([
        transaction.utilisateur.findUnique({
          where: { idUtilisateur: input.idUtilisateur },
          select: { idUtilisateur: true },
        }),
        transaction.role.findUnique({
          where: { codeRole: input.codeRole },
          select: { idRole: true },
        }),
      ]);

      if (!user) return 'USER_NOT_FOUND';
      if (!role) return 'ROLE_NOT_FOUND';

      await transaction.utilisateurRole.create({
        data: {
          idUtilisateur: input.idUtilisateur,
          idRole: role.idRole,
          attribuePar: input.actorId,
          motif: input.motif || null,
        },
      });
      await transaction.evenementMetier.create({
        data: {
          typeEvenement: 'ROLE_ATTRIBUE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.actorId,
          idUtilisateurCible: input.idUtilisateur,
          donneesApres: { codeRole: input.codeRole } satisfies Prisma.InputJsonObject,
          motif: input.motif || `Attribution du rôle ${input.codeRole}`,
        },
      });
    });
  }
}
