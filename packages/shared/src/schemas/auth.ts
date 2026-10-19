import { z } from 'zod';
import { ClientType, RoleCode, EtatCompte } from '../enums.js';

export const LoginRequestSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est obligatoire'),
  clientType: z.nativeEnum(ClientType).default(ClientType.WEB),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserProfileSchema = z.object({
  idUtilisateur: z.string().uuid(),
  nom: z.string(),
  prenom: z.string().nullable(),
  email: z.string().email(),
  telephone: z.string().nullable(),
  etatCompte: z.nativeEnum(EtatCompte),
  roles: z.array(z.nativeEnum(RoleCode)),
  dateInscription: z.string(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  user: UserProfileSchema,
  token: z.string().optional(), // Présent uniquement pour client MOBILE (Bearer)
  clientType: z.nativeEnum(ClientType),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
