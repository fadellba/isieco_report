import { z } from 'zod';
import { EtatAffectation } from '../enums.js';

export const AffectationSchema = z.object({
  idAffectation: z.string().uuid(),
  idDossier: z.string().uuid(),
  idTypeDechet: z.string().uuid(),
  idEquipe: z.string().uuid(),
  idCompetenceEquipe: z.string().uuid(),
  dateHeureAffectation: z.string(),
  idDecideur: z.string().uuid(),
  etatAffectation: z.nativeEnum(EtatAffectation),
  motif: z.string().nullable().optional(),
  observation: z.string().nullable().optional(),
  dateFinAffectation: z.string().nullable().optional(),
  referenceOperationUnique: z.string().nullable().optional(),
});

export type Affectation = z.infer<typeof AffectationSchema>;
