import React, { useState } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi } from '../../services/api.js';
import { useOffline } from '../../context/OfflineContext.js';
import { MissionTerrainItem } from '../../types/index.js';
import { ResultatIntervention } from '@isieco/shared';

export const CompteRenduScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const mission: MissionTerrainItem = route.params?.mission;
  const { isOnline, enqueueDraft } = useOffline();

  const [resultat, setResultat] = useState<ResultatIntervention>(ResultatIntervention.SUCCES_TOTAL);
  const [compteRendu, setCompteRendu] = useState('');
  const [motifException, setMotifException] = useState('');
  const [photoApres, setPhotoApres] = useState<string | null>(null);
  const [uploadedPhotoReference, setUploadedPhotoReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission requise', 'Accès à l appareil photo requis pour la preuve terrain.');
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
    } catch {
      Alert.alert('Erreur', 'Impossible d accéder à la caméra.');
    }
  };

  const handleSubmit = async () => {
    if (!compteRendu || compteRendu.trim().length < 10) {
      Alert.alert(
        'Compte-rendu obligatoire (RG37 / Test T11)',
        'Un compte-rendu d au moins 10 caractères décrivant l opération réalisée est obligatoire.'
      );
      return;
    }

    if (resultat !== ResultatIntervention.SUCCES_TOTAL && (!motifException || motifException.trim().length < 5)) {
      Alert.alert(
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
        Alert.alert(
          'Intervention Clôturée !',
          'Votre compte-rendu et vos observations ont été validés. Le dossier passe en phase de contrôle de salubrité.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        await enqueueDraft('INTERVENTION_TERMINER', {
          idIntervention: mission.idIntervention,
          data: payload,
          photoUri: photoApres || undefined,
        });
        Alert.alert(
          'Enregistré Hors-Ligne',
          'Le compte-rendu a été mis en mémoire tampon locale. Il sera transmis automatiquement dès le retour du réseau.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de clôturer l intervention.');
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

      {/* Résultat de l'intervention */}
      <View style={styles.card}>
        <Text style={styles.label}>1. Résultat des travaux sur site</Text>
        <View style={styles.resultOptions}>
          <TouchableOpacity
            style={[styles.resultBtn, resultat === ResultatIntervention.SUCCES_TOTAL && styles.resultBtnSelected]}
            onPress={() => setResultat(ResultatIntervention.SUCCES_TOTAL)}
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
            onPress={() => setResultat(ResultatIntervention.SUCCES_PARTIEL)}
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
            onPress={() => setResultat(ResultatIntervention.IMPOSSIBLE)}
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
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          value={compteRendu}
          onChangeText={setCompteRendu}
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
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            value={motifException}
            onChangeText={setMotifException}
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
              onPress={() => {
                setPhotoApres(null);
                setUploadedPhotoReference(null);
              }}
            >
              <Text style={styles.retakeText}>Changer la photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto}>
            <Text style={styles.cameraBtnText}>📷 Prendre Photo Après Nettoyage</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitBtnText}>
            {isOnline ? 'Valider et Transmettre le Rapport' : 'Sauvegarder Hors-Ligne'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#f8fafc',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  req: {
    color: '#dc2626',
  },
  resultOptions: {
    gap: 8,
  },
  resultBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  resultBtnSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  resultBtnSelectedAmber: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  resultBtnSelectedRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  resultBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  resultBtnTextSelected: {
    color: '#15803d',
    fontWeight: '800',
  },
  resultBtnTextSelectedAmber: {
    color: '#b45309',
    fontWeight: '800',
  },
  resultBtnTextSelectedRed: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  countValid: {
    color: '#16a34a',
    fontWeight: '700',
  },
  countInvalid: {
    color: '#dc2626',
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
    backgroundColor: '#f1f5f9',
  },
  retakeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  cameraBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cameraBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: {
    backgroundColor: '#86efac',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
