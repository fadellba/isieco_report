import { z } from 'zod';
import { StatutDossier, PrioriteDossier, EtatContenuDossier, NiveauRisque } from '../enums.js';

export const DossierTraitementSchema = z.object({
  idDossier: z.string().uuid(),
  referenceDossier: z.string(),
  descriptionSynthese: z.string(),
  dateCreationDossier: z.string(),
  statutDossier: z.nativeEnum(StatutDossier),
  priorite: z.nativeEnum(PrioriteDossier),
  dateQualification: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  precisionLocalisation: z.number().nullable().optional(),
  descriptionLocalisation: z.string().nullable().optional(),
  dateCloture: z.string().nullable().optional(),
  creePar: z.string().uuid(),
});

export type DossierTraitement = z.infer<typeof DossierTraitementSchema>;

export const ContenuDossierSchema = z.object({
  idDossier: z.string().uuid(),
  idTypeDechet: z.string().uuid(),
  quantiteEstimee: z.string().nullable().optional(),
  volumeEstime: z.string().nullable().optional(),
  niveauRisqueQualifie: z.nativeEnum(NiveauRisque).nullable().optional(),
  remarque: z.string().nullable().optional(),
  qualifiePar: z.string().uuid().nullable().optional(),
  dateQualification: z.string().nullable().optional(),
  etatContenuDossier: z.nativeEnum(EtatContenuDossier),
  dateRetrait: z.string().nullable().optional(),
  retirePar: z.string().uuid().nullable().optional(),
  motifRetrait: z.string().nullable().optional(),
});

export type ContenuDossier = z.infer<typeof ContenuDossierSchema>;
