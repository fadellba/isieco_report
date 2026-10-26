import { ClientType, RoleCode } from '@isieco/shared';
import { IdentityRepository } from '../ports/identity-repository.js';
import { IdentitySecurity } from '../ports/identity-security.js';
import { IdentityRuleError } from '../../domain/identity.js';

export async function login(
  repository: IdentityRepository,
  security: IdentitySecurity,
  input: {
    email: string;
    password: string;
    clientType: ClientType;
    ipAddress: string | null;
    userAgent: string | null;
  },
) {
  const account = await repository.findLoginAccount(input.email);
  if (!account || !security.verifyPassword(input.password, account.motDePasseHash)) {
    throw new IdentityRuleError('INVALID_CREDENTIALS', 'Identifiants de connexion invalides.');
  }
  if (account.etatCompte !== 'ACTIF') {
    throw new IdentityRuleError(
      'ACCOUNT_INACTIVE',
      `Le compte utilisateur est ${account.etatCompte.toLowerCase()}. Connexion impossible.`,
    );
  }

  const token = security.createSessionToken();
  const idSession = await repository.createSession({
    idUtilisateur: account.idUtilisateur,
    tokenHash: security.hashSessionToken(token),
    clientType: input.clientType,
    dateExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    token,
    idSession,
    user: {
      idUtilisateur: account.idUtilisateur,
      nom: account.nom,
      prenom: account.prenom,
      email: account.email,
      telephone: account.telephone,
      etatCompte: account.etatCompte,
      roles: account.roles,
      dateInscription: account.dateInscription,
    },
  };
}

export async function getAuthenticatedContext(
  repository: IdentityRepository,
  security: IdentitySecurity,
  token: string,
  now = new Date(),
) {
  const session = await repository.findAuthenticatedSession(security.hashSessionToken(token));
  if (!session) {
    throw new IdentityRuleError('SESSION_NOT_FOUND', 'Session invalide ou expirée.');
  }
  if (session.dateExpiration < now) {
    throw new IdentityRuleError('SESSION_EXPIRED', 'Session expirée. Veuillez vous reconnecter.');
  }
  if (session.user.etatCompte !== 'ACTIF') {
    throw new IdentityRuleError(
      'ACCOUNT_INACTIVE',
      `Compte utilisateur ${session.user.etatCompte.toLowerCase()}. Accès refusé.`,
    );
  }

  return {
    ...session.user,
    roles: session.user.roles.map((role) => role as RoleCode),
    idSession: session.idSession,
    clientType: session.clientType as ClientType,
  };
}

export async function logout(repository: IdentityRepository, idSession: string): Promise<void> {
  await repository.revokeSession(idSession);
}

export async function getCurrentProfile(repository: IdentityRepository, idUtilisateur: string) {
  const user = await repository.findUser(idUtilisateur);
  if (!user) {
    throw new IdentityRuleError('USER_NOT_FOUND', 'Utilisateur associé à la session introuvable.');
  }
  return user;
}

export async function updateCurrentProfile(
  repository: IdentityRepository,
  input: {
    idUtilisateur: string;
    nom: string;
    prenom: string | null;
    telephone: string | null;
  },
): Promise<void> {
  if (!input.nom || input.nom.length > 100 || (input.prenom && input.prenom.length > 100)
    || (input.telephone && input.telephone.length > 50)) {
    throw new IdentityRuleError('INVALID_PROFILE', 'Vérifiez les longueurs des champs du profil.');
  }
  if (!await repository.updateProfileAndAudit(input)) {
    throw new IdentityRuleError('USER_NOT_FOUND', 'Utilisateur associé à la session introuvable.');
  }
}

export async function changeCurrentPassword(
  repository: IdentityRepository,
  security: IdentitySecurity,
  input: {
    idUtilisateur: string;
    currentSessionId: string;
    currentPassword: string;
    newPassword: string;
  },
): Promise<void> {
  if (input.newPassword.length < 12 || input.newPassword.length > 128) {
    throw new IdentityRuleError(
      'INVALID_PROFILE',
      'Le nouveau mot de passe doit contenir de 12 à 128 caractères.',
    );
  }

  const passwordHash = await repository.findPasswordHash(input.idUtilisateur);
  if (!passwordHash) {
    throw new IdentityRuleError('USER_NOT_FOUND', 'Utilisateur associé à la session introuvable.');
  }
  if (!security.verifyPassword(input.currentPassword, passwordHash)) {
    throw new IdentityRuleError('INVALID_CURRENT_PASSWORD', 'Le mot de passe actuel est incorrect.');
  }
  if (security.verifyPassword(input.newPassword, passwordHash)) {
    throw new IdentityRuleError(
      'UNCHANGED_PASSWORD',
      'Choisissez un mot de passe différent de votre mot de passe actuel.',
    );
  }

  await repository.changePasswordAndRevokeOtherSessions({
    idUtilisateur: input.idUtilisateur,
    currentSessionId: input.currentSessionId,
    passwordHash: security.hashPassword(input.newPassword),
  });
}

export async function listUsers(repository: IdentityRepository) {
  return repository.listUsers();
}

export async function updateAccountStatus(
  repository: IdentityRepository,
  input: {
    idUtilisateur: string;
    actorId: string;
    etatCompte: string;
    motif: string | null;
  },
): Promise<boolean> {
  if (!['ACTIF', 'INACTIF', 'SUSPENDU'].includes(input.etatCompte)) {
    throw new IdentityRuleError(
      'INVALID_ACCOUNT_STATUS',
      "L'état du compte doit être ACTIF, INACTIF ou SUSPENDU.",
    );
  }
  return repository.updateAccountStatusAndAudit(input);
}

export async function assignRole(
  repository: IdentityRepository,
  input: {
    idUtilisateur: string;
    actorId: string;
    codeRole: string;
    motif: string | null;
  },
): Promise<'USER_NOT_FOUND' | 'ROLE_NOT_FOUND' | void> {
  return repository.assignRoleAndAudit(input);
}
