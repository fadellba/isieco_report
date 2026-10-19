import { z } from 'zod';
import { EtatCompte, RoleCode } from '../enums.js';

export const UtilisateurSchema = z.object({
  idUtilisateur: z.string().uuid(),
  nom: z.string().min(1),
  prenom: z.string().nullable().optional(),
  email: z.string().email(),
  telephone: z.string().nullable().optional(),
  dateInscription: z.string(),
  etatCompte: z.nativeEnum(EtatCompte),
});

export type Utilisateur = z.infer<typeof UtilisateurSchema>;

export const UtilisateurRoleSchema = z.object({
  idUtilisateur: z.string().uuid(),
  idRole: z.string().uuid(),
  dateDebut: z.string(),
  dateFin: z.string().nullable().optional(),
  attribuePar: z.string().uuid().nullable().optional(),
  motif: z.string().nullable().optional(),
});

export type UtilisateurRole = z.infer<typeof UtilisateurRoleSchema>;

export const RoleSchema = z.object({
  idRole: z.string().uuid(),
  codeRole: z.nativeEnum(RoleCode),
  libelleRole: z.string(),
  description: z.string().nullable().optional(),
});

export type Role = z.infer<typeof RoleSchema>;
