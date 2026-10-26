import {
  RecordVerificationInput,
  VerificationRuleError,
} from '../../domain/verifications.js';
import { VerificationsRepository } from '../ports/verifications-repository.js';
import { ResultatVerification } from '@isieco/shared';

export async function recordResolutionVerification(
  repository: VerificationsRepository,
  input: RecordVerificationInput,
): Promise<string> {
  if (!input.idAffectation || !input.resultatVerification) {
    throw new VerificationRuleError(
      'AFFECTATION_NOT_PENDING',
      "L'identifiant de l'affectation et le résultat de vérification sont obligatoires.",
    );
  }
  if (!Object.values(ResultatVerification).includes(input.resultatVerification as ResultatVerification)) {
    throw new VerificationRuleError(
      'INVALID_VERIFICATION_RESULT',
      'Le résultat de vérification est invalide.',
    );
  }
  if (
    input.resultatVerification !== ResultatVerification.CONFORME_RESOLU &&
    (!input.motif || input.motif.trim().length < 10)
  ) {
    throw new VerificationRuleError(
      'VERIFICATION_REASON_REQUIRED',
      'Un motif d’au moins 10 caractères est obligatoire lorsqu’une résolution n’est pas confirmée.',
    );
  }
  return repository.transaction(async (transaction) => {
    await transaction.lockAffectation(input.idAffectation);
    const affectation = await transaction.findAffectation(input.idAffectation);
    if (!affectation) {
      throw new VerificationRuleError('AFFECTATION_NOT_FOUND', 'Affectation introuvable.');
    }
    if (affectation.etatAffectation !== 'A_VERIFIER' || affectation.dateFinAffectation) {
      throw new VerificationRuleError(
        'AFFECTATION_NOT_PENDING',
        'Seule une affectation active en attente de vérification peut être contrôlée.',
      );
    }

    const idIntervention = await transaction.findLatestCompletedIntervention(input.idAffectation);
    if (!idIntervention) {
      throw new VerificationRuleError(
        'COMPLETED_INTERVENTION_NOT_FOUND',
        'Aucune intervention terminée ne peut être vérifiée pour cette affectation.',
      );
    }
    if (!(await transaction.hasCompletionTrace(idIntervention))) {
      throw new VerificationRuleError(
        'COMPLETION_TRACE_NOT_FOUND',
        "La trace de l'agent ayant terminé l'intervention est introuvable.",
      );
    }
    if (await transaction.wasCompletedByVerifier(input.idAffectation, input.idVerificateur)) {
      throw new VerificationRuleError(
        'SEPARATION_OF_DUTIES',
        "L'agent ayant réalisé l'intervention ne peut pas vérifier sa propre intervention.",
      );
    }

    await transaction.replaceCurrentVerifications(input.idAffectation);
    const idVerification = await transaction.createVerification(input);
    const motif = input.motif || (
      input.resultatVerification === ResultatVerification.CONFORME_RESOLU
        ? 'Résolution validée par le vérificateur'
        : 'Intervention non conforme ou partielle : reprise nécessaire'
    );
    if (input.resultatVerification === ResultatVerification.CONFORME_RESOLU) {
      await transaction.setAffectationResolved(input.idAffectation, new Date());
      await transaction.createVerificationEvent({
        typeEvenement: 'RESOLUTION_CONFIRMEE',
        idActeur: input.idVerificateur,
        idVerificationCible: idVerification,
        motif,
      });
    } else {
      await transaction.resetAffectationForRework(input.idAffectation);
      await transaction.createVerificationEvent({
        typeEvenement: 'VERIFICATION_ENREGISTREE',
        idActeur: input.idVerificateur,
        idVerificationCible: idVerification,
        motif,
      });
      await transaction.createProgrammedIntervention(input.idAffectation, input.idVerificateur);
    }
    return idVerification;
  });
}

export async function closeVerifiedDossier(
  repository: VerificationsRepository,
  idDossier: string,
  idActeur: string,
  motif?: string,
): Promise<void> {
  return repository.transaction(async (transaction) => {
    await transaction.lockDossier(idDossier);
    const statutDossier = await transaction.findDossierStatus(idDossier);
    if (!statutDossier) {
      throw new VerificationRuleError('DOSSIER_NOT_FOUND', 'Dossier introuvable.');
    }
    if (statutDossier !== 'EN_ATTENTE_VERIFICATION') {
      throw new VerificationRuleError(
        'DOSSIER_NOT_PENDING',
        'Seul un dossier en attente de vérification peut être clôturé.',
      );
    }
    const voletsInclus = await transaction.listIncludedWasteTypes(idDossier);
    if (voletsInclus.length === 0) {
      throw new VerificationRuleError(
        'DOSSIER_HAS_NO_ACTIVE_CONTENT',
        'Le dossier ne comporte aucun volet technique actif à traiter.',
      );
    }
    const derniereReouverture = await transaction.findLatestReopeningDate(idDossier);
    const nonResolus: string[] = [];
    for (const volet of voletsInclus) {
      const affectation = await transaction.findLatestResolution(idDossier, volet.idTypeDechet);
      const afterReopening = !derniereReouverture
        || (affectation !== null
          && affectation.dateVerification !== null
          && affectation.dateHeureAffectation > derniereReouverture
          && affectation.dateVerification > derniereReouverture);
      if (
        !affectation
        || affectation.etatAffectation !== 'TERMINEE'
        || !affectation.dateVerification
        || !afterReopening
      ) {
        nonResolus.push(volet.codeType);
      }
    }
    if (nonResolus.length > 0) {
      throw new VerificationRuleError(
        'DOSSIER_NOT_FULLY_RESOLVED',
        `Clôture impossible : 100% des volets inclus doivent être résolus et vérifiés avec succès${derniereReouverture ? ' après la dernière réouverture' : ''}. Volet(s) non résolu(s) : [${nonResolus.join(', ')}] (Test T13).`,
      );
    }

    await transaction.closeDossier(idDossier, new Date());
    await transaction.createVerificationEvent({
      typeEvenement: 'DOSSIER_CLOS',
      idActeur,
      idDossierCible: idDossier,
      motif: motif || 'Clôture complète suite à vérification positive de tous les volets',
    });
    const declarants = new Set(await transaction.listDeclarantIds(idDossier));
    for (const idUtilisateur of declarants) {
      await transaction.notifyDeclarant(idUtilisateur, idDossier);
    }
  });
}

export async function reopenClosedDossier(
  repository: VerificationsRepository,
  idDossier: string,
  idActeur: string,
  motif: string,
): Promise<void> {
  if (!motif || motif.trim().length < 10) {
    throw new VerificationRuleError(
      'REOPEN_REASON_REQUIRED',
      "Un motif explicite d'au moins 10 caractères est obligatoire pour rouvrir un dossier (Test T15 / T36).",
    );
  }
  return repository.transaction(async (transaction) => {
    await transaction.lockDossier(idDossier);
    const statutDossier = await transaction.findDossierStatus(idDossier);
    if (!statutDossier) {
      throw new VerificationRuleError('DOSSIER_NOT_FOUND', 'Dossier introuvable.');
    }
    if (!['CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE'].includes(statutDossier)) {
      throw new VerificationRuleError(
        'DOSSIER_NOT_CLOSED',
        "Seul un dossier préalablement clôturé peut faire l'objet d'une réouverture.",
      );
    }
    await transaction.reopenDossier(idDossier);
    await transaction.createVerificationEvent({
      typeEvenement: 'DOSSIER_REOUVERT',
      idActeur,
      idDossierCible: idDossier,
      donneesAvant: { statutDossier },
      donneesApres: { statutDossier: 'EN_ATTENTE_AFFECTATION' },
      motif: motif.trim(),
    });
  });
}
