import { z } from 'zod';

export const HistoriquePointsSchema = z.object({
  idPoint: z.string().uuid(),
  idUtilisateur: z.string().uuid(),
  idSignalement: z.string().uuid().nullable().optional(),
  points: z.number().int().positive('Le nombre de points attribués doit être strictement positif'),
  dateAttribution: z.string(),
  motif: z.string().min(3, "Le motif d'attribution est obligatoire"),
});

export type HistoriquePoints = z.infer<typeof HistoriquePointsSchema>;

export const SoldePointsCitoyenSchema = z.object({
  idUtilisateur: z.string().uuid(),
  soldeTotal: z.number().int().nonnegative(),
  historique: z.array(HistoriquePointsSchema),
});

export type SoldePointsCitoyen = z.infer<typeof SoldePointsCitoyenSchema>;
