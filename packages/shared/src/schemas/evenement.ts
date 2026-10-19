import { z } from 'zod';
import { TypeEvenement, OrigineEvenement } from '../enums.js';

export const EvenementMetierSchema = z.object({
  idEvenement: z.string().uuid(),
  typeEvenement: z.nativeEnum(TypeEvenement),
  dateEvenement: z.string().nullable().optional(),
  dateEnregistrement: z.string(),
  origine: z.nativeEnum(OrigineEvenement),
  idActeur: z.string().uuid().nullable().optional(),
  
  // Cibles simples
  idSignalementCible: z.string().uuid().nullable().optional(),
  idDossierCible: z.string().uuid().nullable().optional(),
  idRattachementCible: z.string().uuid().nullable().optional(),
  idAffectationCible: z.string().uuid().nullable().optional(),
  idInterventionCible: z.string().uuid().nullable().optional(),
  idVerificationCible: z.string().uuid().nullable().optional(),
  idUtilisateurCible: z.string().uuid().nullable().optional(),
  idEquipeCible: z.string().uuid().nullable().optional(),
  idTypeDechetCible: z.string().uuid().nullable().optional(),
  idCompetenceEquipeCible: z.string().uuid().nullable().optional(),
  
  // Cible composite CONTENU_DOSSIER
  idDossierContenuCible: z.string().uuid().nullable().optional(),
  idTypeDechetContenuCible: z.string().uuid().nullable().optional(),
  
  idEvenementCorrige: z.string().uuid().nullable().optional(),
  donneesAvant: z.string().nullable().optional(),
  donneesApres: z.string().nullable().optional(),
  destinataireExterne: z.string().nullable().optional(),
  motif: z.string().nullable().optional(),
  correlationId: z.string().nullable().optional(),
  referenceOperationUnique: z.string().nullable().optional(),
  versionSchema: z.string().default('2.13'),
}).refine(
  (ev) => {
    // Vérifier la règle composite : les 2 identifiants doivent être tous deux renseignés ou tous deux nuls
    const contenuComplet = (ev.idDossierContenuCible != null && ev.idTypeDechetContenuCible != null);
    const contenuPartiel = (ev.idDossierContenuCible != null && ev.idTypeDechetContenuCible == null) ||
                           (ev.idDossierContenuCible == null && ev.idTypeDechetContenuCible != null);
    if (contenuPartiel) return false;

    // Compter le nombre de groupes cibles non nuls
    const simples = [
      ev.idSignalementCible,
      ev.idDossierCible,
      ev.idRattachementCible,
      ev.idAffectationCible,
      ev.idInterventionCible,
      ev.idVerificationCible,
      ev.idUtilisateurCible,
      ev.idEquipeCible,
      ev.idTypeDechetCible,
      ev.idCompetenceEquipeCible,
    ].filter((val) => val != null).length;

    const composite = contenuComplet ? 1 : 0;
    const totalGroupes = simples + composite;

    return totalGroupes === 1;
  },
  {
    message: "L'événement métier doit cibler exactement un objet principal (règle MLD §3.12 / T17 / T32)",
    path: ['idDossierCible'],
  }
);

export type EvenementMetier = z.infer<typeof EvenementMetierSchema>;
