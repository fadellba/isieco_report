import { z } from 'zod';
import { StatutIntervention, ResultatIntervention, ContextePhoto } from '../enums.js';

export const InterventionSchema = z.object({
  idIntervention: z.string().uuid(),
  idAffectation: z.string().uuid(),
  dateHeureDebut: z.string().nullable().optional(),
  dateHeureFin: z.string().nullable().optional(),
  statutIntervention: z.nativeEnum(StatutIntervention),
  resultatIntervention: z.nativeEnum(ResultatIntervention).nullable().optional(),
  compteRendu: z.string().nullable().optional(),
  motifException: z.string().nullable().optional(),
  renseignePar: z.string().uuid(),
});

export type Intervention = z.infer<typeof InterventionSchema>;

export const FinishInterventionSchema = z.object({
  idIntervention: z.string().uuid(),
  dateHeureFin: z.string(),
  resultatIntervention: z.nativeEnum(ResultatIntervention),
  compteRendu: z.string().min(10, 'Le compte-rendu doit comporter au moins 10 caractères (RG37)'),
  motifException: z.string().nullable().optional(),
});

export type FinishInterventionInput = z.infer<typeof FinishInterventionSchema>;

export const PhotoInterventionSchema = z.object({
  idPhotoIntervention: z.string().uuid(),
  idIntervention: z.string().uuid(),
  referencePhoto: z.string(),
  contextePhoto: z.nativeEnum(ContextePhoto),
  description: z.string().nullable().optional(),
  dateAjout: z.string(),
});

export type PhotoIntervention = z.infer<typeof PhotoInterventionSchema>;
