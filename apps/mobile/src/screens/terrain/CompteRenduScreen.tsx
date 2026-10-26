import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi } from '../../services/api.js';
import { useOffline } from '../../context/OfflineContext.js';
import { MissionTerrainItem } from '../../types/index.js';
import { ResultatIntervention } from '@isieco/shared';
import { useTheme } from '../../context/ThemeContext.js';
import type { DesignTokens } from '@isieco/shared';

export const CompteRenduScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const mission: MissionTerrainItem = route.params?.mission;
  const { isOnline, enqueueDraft } = useOffline();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [resultat, setResultat] = useState<ResultatIntervention>(ResultatIntervention.SUCCES_TOTAL);
  const [compteRendu, setCompteRendu] = useState('');
  const [motifException, setMotifException] = useState('');
  const [photoApres, setPhotoApres] = useState<string | null>(null);
  const [uploadedPhotoReference, setUploadedPhotoReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const showFeedback = (
    type: 'success' | 'error',
    title: string,
    message: string,
    onConfirm?: () => void
  ) => {
    if (Platform.OS === 'web') {
      setFeedback({ type, title, message });
      return;
    }
    Alert.alert(title, message, onConfirm ? [{ text: 'OK', onPress: onConfirm }] : undefined);
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showFeedback(
          'error',
          'Permission requise',
          'Accès à l appareil photo requis pour la preuve terrain.'
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPhotoApres(res.assets[0].uri);
        setUploadedPhotoReference(null);
      }
    } catch (error) {
      showFeedback(
        'error',
        'Erreur',
        error instanceof Error ? error.message : 'Impossible d accéder à la caméra.'
      );
    }
  };

  const handleSubmit = async () => {
    if (!compteRendu || compteRendu.trim().length < 10) {
      showFeedback(
        'error',
        'Compte-rendu obligatoire (RG37 / Test T11)',
        'Un compte-rendu d au moins 10 caractères décrivant l opération réalisée est obligatoire.'
      );
      return;
    }

    if (resultat !== ResultatIntervention.SUCCES_TOTAL && (!motifException || motifException.trim().length < 5)) {
      showFeedback(
        'error',
        'Motif d exception requis',
        'Veuillez justifier la raison du résultat partiel ou de l impossibilité d intervention.'
      );
      return;
    }

    const payload = {
      resultatIntervention: resultat,
      compteRendu: compteRendu.trim(),
      motifException: motifException.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (isOnline) {
        if (photoApres && !uploadedPhotoReference) {
          const photo = await mobileApi.interventions.uploadPhoto(mission.idIntervention, photoApres);
          setUploadedPhotoReference(photo.referencePhoto);
        }
        await mobileApi.interventions.terminer(mission.idIntervention, payload);
        showFeedback(
          'success',
          'Intervention Clôturée !',
          'Votre compte-rendu et vos observations ont été validés. Le dossier passe en phase de contrôle de salubrité.',
          () => navigation.goBack()
        );
        setSubmitted(true);
      } else {
        await enqueueDraft({
          type: 'INTERVENTION_TERMINER',
          payload: {
            idIntervention: mission.idIntervention,
            data: payload,
            photoUri: photoApres || undefined,
          },
        });
        showFeedback(
          'success',
          'Enregistré Hors-Ligne',
          'Le compte-rendu a été mis en mémoire tampon locale. Il sera transmis automatiquement dès le retour du réseau.',
          () => navigation.goBack()
        );
        setSubmitted(true);
      }
    } catch (error) {
      showFeedback(
        'error',
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de clôturer l intervention.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.title}>Rapport de Clôture Terrain</Text>
        <Text style={styles.subtitle}>
          Dossier : {mission.referenceDossier} • Volet : {mission.libelleDechet}
        </Text>
      </View>

      {feedback && (
        <View
          accessibilityRole={feedback.type === 'error' ? 'alert' : 'status'}
          style={[styles.feedback, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}
        >
          <Text style={styles.feedbackTitle}>{feedback.title}</Text>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
        </View>
      )}

      {/* Résultat de l'intervention */}
      <View style={styles.card}>
        <Text style={styles.label}>1. Résultat des travaux sur site</Text>
        <View style={styles.resultOptions}>
          <TouchableOpacity
            style={[styles.resultBtn, resultat === ResultatIntervention.SUCCES_TOTAL && styles.resultBtnSelected]}
            onPress={() => {
              setResultat(ResultatIntervention.SUCCES_TOTAL);
              setFeedback(null);
            }}
            disabled={submitted}
          >
            <Text
              style={[
                styles.resultBtnText,
                resultat === ResultatIntervention.SUCCES_TOTAL && styles.resultBtnTextSelected,
              ]}
            >
              ✓ Succès Total (Évacué)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resultBtn, resultat === ResultatIntervention.SUCCES_PARTIEL && styles.resultBtnSelectedAmber]}
            onPress={() => {
              setResultat(ResultatIntervention.SUCCES_PARTIEL);
              setFeedback(null);
            }}
            disabled={submitted}
          >
            <Text
              style={[
                styles.resultBtnText,
                resultat === ResultatIntervention.SUCCES_PARTIEL && styles.resultBtnTextSelectedAmber,
              ]}
            >
              ⚠️ Succès Partiel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resultBtn, resultat === ResultatIntervention.IMPOSSIBLE && styles.resultBtnSelectedRed]}
            onPress={() => {
              setResultat(ResultatIntervention.IMPOSSIBLE);
              setFeedback(null);
            }}
            disabled={submitted}
          >
            <Text
              style={[
                styles.resultBtnText,
                resultat === ResultatIntervention.IMPOSSIBLE && styles.resultBtnTextSelectedRed,
              ]}
            >
              ✕ Impossible d'intervenir
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Compte-rendu terrain */}
      <View style={styles.card}>
        <Text style={styles.label}>
          2. Compte-rendu d'exécution <Text style={styles.req}>*</Text>
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder="Ex: Nettoyage complet réalisé. Évacuation de 3m³ de déchets vers la décharge de Mbeubeuss. Site dégagé et désinfecté..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={4}
          value={compteRendu}
          onChangeText={(value) => {
            setCompteRendu(value);
            setFeedback(null);
          }}
          editable={!submitted}
        />
        <Text style={[styles.charCount, compteRendu.trim().length >= 10 ? styles.countValid : styles.countInvalid]}>
          {compteRendu.trim().length} / 10 caractères min (Règle RG37)
        </Text>
      </View>

      {/* Motif d'exception if partial/failed */}
      {resultat !== ResultatIntervention.SUCCES_TOTAL && (
        <View style={styles.card}>
          <Text style={styles.label}>
            3. Motif d'exception ou obstacle rencontré <Text style={styles.req}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Ex: Accès bloqué par des véhicules en stationnement sauvage, engin mécanique complémentaire requis..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            value={motifException}
            onChangeText={(value) => {
              setMotifException(value);
              setFeedback(null);
            }}
            editable={!submitted}
          />
        </View>
      )}

      {/* Photo Preuve Réalisation */}
      <View style={styles.card}>
        <Text style={styles.label}>Photo après intervention (Preuve de salubrité)</Text>
        {photoApres ? (
          <View style={styles.photoBox}>
            <Image source={{ uri: photoApres }} style={styles.photoImg} />
            <TouchableOpacity
              style={styles.retakeBtn}
              disabled={submitted}
              onPress={() => {
                setPhotoApres(null);
                setUploadedPhotoReference(null);
              }}
            >
              <Text style={styles.retakeText}>Changer la photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto} disabled={submitted}>
            <Text style={styles.cameraBtnText}>📷 Prendre Photo Après Nettoyage</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={submitted ? () => navigation.goBack() : handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.submitBtnText}>
            {submitted
              ? 'Retour aux missions'
              : isOnline
                ? 'Valider et Transmettre le Rapport'
                : 'Sauvegarder Hors-Ligne'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (colors: DesignTokens) => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  feedback: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  feedbackError: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
  },
  feedbackSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  req: {
    color: colors.danger,
  },
  resultOptions: {
    gap: 8,
  },
  resultBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultBtnSelected: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  resultBtnSelectedAmber: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
  },
  resultBtnSelectedRed: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
  },
  resultBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resultBtnTextSelected: {
    color: colors.success,
    fontWeight: '800',
  },
  resultBtnTextSelectedAmber: {
    color: colors.warning,
    fontWeight: '800',
  },
  resultBtnTextSelectedRed: {
    color: colors.danger,
    fontWeight: '800',
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  countValid: {
    color: colors.success,
    fontWeight: '700',
  },
  countInvalid: {
    color: colors.danger,
  },
  photoBox: {
    alignItems: 'center',
  },
  photoImg: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  retakeBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
  },
  retakeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cameraBtn: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cameraBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: {
    backgroundColor: colors.primary,
    opacity: 0.65,
  },
  submitBtnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
