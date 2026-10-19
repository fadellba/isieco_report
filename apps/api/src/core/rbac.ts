import { RoleCode } from '@isieco/shared';
import { ForbiddenError } from './errors.js';

export interface UserContext {
  idUtilisateur: string;
  email: string;
  nom: string;
  prenom?: string | null;
  etatCompte: string;
  roles: RoleCode[];
  idSession: string;
  clientType: 'WEB' | 'MOBILE';
  telephone?: string | null;
  dateInscription?: string;
}

/**
 * Vérifie si l'utilisateur possède au moins un des rôles autorisés.
 * Si ADMIN est présent, il a accès aux fonctions d'administration, mais la séparation
 * des tâches interdit le cumul tacite de droits métier sensibles (RG03 / Personas demo).
 */
export function hasAnyRole(user: UserContext, allowedRoles: RoleCode[]): boolean {
  if (!user || !user.roles) return false;
  return user.roles.some((role) => allowedRoles.includes(role));
}

/**
 * Garde d'autorisation déclenchant une ForbiddenError explicite en cas de non concordance.
 */
export function requireAnyRole(user: UserContext, allowedRoles: RoleCode[], actionName?: string): void {
  if (!hasAnyRole(user, allowedRoles)) {
    const actionText = actionName ? ` pour l'action : ${actionName}` : '';
    throw new ForbiddenError(
      `Accès refusé${actionText}. Rôles autorisés : [${allowedRoles.join(', ')}]. Rôles de l'utilisateur : [${user.roles.join(', ')}]`
    );
  }
}
