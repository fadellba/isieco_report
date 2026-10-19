import { z } from 'zod';
import { EtatVerification, ResultatVerification } from '../enums.js';

export const VerificationResolutionSchema = z.object({
  idVerification: z.string().uuid(),
  idAffectation: z.string().uuid(),
  idVerificateur: z.string().uuid(),
  dateVerification: z.string(),
  resultatVerification: z.nativeEnum(ResultatVerification),
  etatVerification: z.nativeEnum(EtatVerification),
  motif: z.string().nullable().optional(),
  referencePreuve: z.string().nullable().optional(),
});

export type VerificationResolution = z.infer<typeof VerificationResolutionSchema>;
