import { RoleCode } from '@isieco/shared';

export interface IdentityUser {
  idUtilisateur: string;
  nom: string;
  prenom: string | null;
  email: string;
  telephone: string | null;
  etatCompte: string;
  dateInscription: Date;
  roles: RoleCode[];
}

export interface LoginAccount extends IdentityUser {
  motDePasseHash: string;
}

export interface AuthenticatedSession {
  idSession: string;
  clientType: string;
  dateExpiration: Date;
  user: IdentityUser;
}

export interface IdentityRepository {
  findLoginAccount(email: string): Promise<LoginAccount | null>;
  createSession(input: {
    idUtilisateur: string;
    tokenHash: string;
    clientType: string;
    dateExpiration: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<string>;
  findAuthenticatedSession(tokenHash: string): Promise<AuthenticatedSession | null>;
  revokeSession(idSession: string): Promise<void>;
  findUser(idUtilisateur: string): Promise<IdentityUser | null>;
  findPasswordHash(idUtilisateur: string): Promise<string | null>;
  updateProfileAndAudit(input: {
    idUtilisateur: string;
    nom: string;
    prenom: string | null;
    telephone: string | null;
  }): Promise<boolean>;
  changePasswordAndRevokeOtherSessions(input: {
    idUtilisateur: string;
    currentSessionId: string;
    passwordHash: string;
  }): Promise<void>;
  listUsers(): Promise<IdentityUser[]>;
  updateAccountStatusAndAudit(input: {
    idUtilisateur: string;
    actorId: string;
    etatCompte: string;
    motif: string | null;
  }): Promise<boolean>;
  assignRoleAndAudit(input: {
    idUtilisateur: string;
    actorId: string;
    codeRole: string;
    motif: string | null;
  }): Promise<'USER_NOT_FOUND' | 'ROLE_NOT_FOUND' | void>;
}
