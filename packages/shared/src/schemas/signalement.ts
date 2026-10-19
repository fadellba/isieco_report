import { z } from 'zod';
import { StatutSignalement } from '../enums.js';

export const ContenuSignalementInputSchema = z.object({
  idTypeDechet: z.string().uuid(),
  quantiteEstimee: z.string().nullable().optional(),
  volumeEstime: z.string().nullable().optional(),
  remarque: z.string().nullable().optional(),
});

export const CreateSignalementSchema = z.object({
  description: z.string().min(5, 'La description doit comporter au moins 5 caractères'),
  dateConstat: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  precisionLocalisation: z.number().nullable().optional(),
  descriptionLocalisation: z.string().nullable().optional(),
  categories: z.array(ContenuSignalementInputSchema).min(1, 'Au moins une catégorie doit être renseignée'),
}).refine(
  (data) => (data.latitude != null && data.longitude != null) || (data.descriptionLocalisation != null && data.descriptionLocalisation.trim().length > 0),
  {
    message: 'Des coordonnées GPS ou un repère textuel sont obligatoires (RG06/RG07)',
    path: ['latitude'],
  }
);

export type CreateSignalementInput = z.infer<typeof CreateSignalementSchema>;

export const SignalementSchema = z.object({
  idSignalement: z.string().uuid(),
  idUtilisateur: z.string().uuid(),
  dateConstat: z.string().nullable().optional(),
  dateSoumission: z.string(),
  description: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  precisionLocalisation: z.number().nullable().optional(),
  descriptionLocalisation: z.string().nullable().optional(),
  statutSignalement: z.nativeEnum(StatutSignalement),
  decisionPar: z.string().uuid().nullable().optional(),
  dateDecision: z.string().nullable().optional(),
  motifDecision: z.string().nullable().optional(),
});

export type Signalement = z.infer<typeof SignalementSchema>;
