import React, { useState, useEffect } from 'react';
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
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi } from '../../services/api.js';
import { useOffline } from '../../context/OfflineContext.js';
import { TypeDechetRef } from '../../types/index.js';

export const NouveauSignalementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { isOnline, enqueueDraft } = useOffline();

  const [description, setDescription] = useState('');
  const [descriptionLoc, setDescriptionLoc] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [typesDechets, setTypesDechets] = useState<TypeDechetRef[]>([]);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [quantites, setQuantites] = useState<Record<string, string>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const loadTypesDechets = async () => {
    try {
      const data = await mobileApi.referentiels.getTypesDechets();
      setTypesDechets(data);
      setTypesError(null);
    } catch (error) {
      setTypesDechets([]);
      setTypesError(
        error instanceof Error ? error.message : 'Impossible de charger les catégories.'
      );
    }
  };

  useEffect(() => {
    void loadTypesDechets();
  }, []);

  const handleGetLocation = async () => {
    setLocLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLatitude(null);
        setLongitude(null);
        setAccuracy(null);
        setLocationError('Autorisez la localisation ou indiquez un repère textuel précis.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setAccuracy(loc.coords.accuracy);
    } catch (error) {
      setLatitude(null);
      setLongitude(null);
      setAccuracy(null);
      setLocationError(
        error instanceof Error ? error.message : 'La position GPS n’a pas pu être obtenue.'
      );
    } finally {
      setLocLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPhotoUri(res.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de sélectionner la photo.'
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission requise', 'Accès à l appareil photo requis.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPhotoUri(res.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible d’ouvrir la caméra.'
      );
    }
  };

  const toggleCategory = (id: string) => {
    if (selectedTypes.includes(id)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== id));
    } else {
      setSelectedTypes([...selectedTypes, id]);
    }
  };

  const handleSubmit = async () => {
    if (description.trim().length < 5) {
      Alert.alert('Description trop courte', 'La description doit comporter au moins 5 caractères.');
      return;
    }

    const hasGps = latitude != null && longitude != null;
    const hasText = descriptionLoc.trim().length > 0;
    if (!hasGps && !hasText) {
      Alert.alert(
        'Localisation requise (RG06/RG07)',
        'Veuillez capturer votre position GPS ou renseigner un repère textuel précis (ex: Angle Rue Wagane Diouf).'
      );
      return;
    }

    if (typesError) {
      Alert.alert('Catégories indisponibles', 'Réessayez de charger les catégories avant de transmettre le signalement.');
      return;
    }
    if (selectedTypes.length === 0) {
      Alert.alert('Catégorie requise', 'Sélectionnez au moins une catégorie de déchet constatée.');
      return;
    }

    const categoriesPayload = selectedTypes.map((id) => ({
      idTypeDechet: id,
      quantiteEstimee: quantites[id] || 'Non quantifié',
      remarque: `Signalé par citoyen via mobile`,
    }));

    const draft = {
      description: description.trim(),
      latitude,
      longitude,
      precisionLocalisation: accuracy,
      descriptionLocalisation: descriptionLoc.trim() || null,
      categories: categoriesPayload,
      photoUri,
    };

    setSubmitting(true);
    try {
      if (isOnline) {
        const created = await mobileApi.signalements.create(draft);
        let photoEnAttente = false;
        let photoErreur = '';
        if (photoUri) {
          try {
            await mobileApi.signalements.uploadPhoto(created.idSignalement, photoUri);
          } catch (error) {
            await enqueueDraft('SIGNALEMENT_CREATION', {
              ...draft,
              idSignalementCree: created.idSignalement,
            });
            photoEnAttente = true;
            photoErreur =
              error instanceof Error ? ` Détail : ${error.message}` : '';
          }
        }
        Alert.alert(
          photoEnAttente ? 'Signalement enregistré, photo en attente' : 'Signalement enregistré !',
          photoEnAttente
            ? `Le signalement a été transmis. La photo est conservée dans la file locale et pourra être renvoyée depuis la synchronisation.${photoErreur}`
            : 'Merci pour votre contribution citoyenne. Votre signalement a été transmis à la cellule de qualification.',
          [{ text: 'Voir mes signalements', onPress: () => navigation.navigate('MesSignalements') }]
        );
      } else {
        await enqueueDraft('SIGNALEMENT_CREATION', draft);
        Alert.alert(
          'Mode Hors-Ligne',
          'Réseau indisponible : votre signalement a été mis en mémoire tampon locale. Il sera synchronisé dès le retour de la connexion.',
          [{ text: 'OK', onPress: () => navigation.navigate('MesSignalements') }]
        );
      }

      // Reset form
      setDescription('');
      setDescriptionLoc('');
      setSelectedTypes([]);
      setPhotoUri(null);
    } catch (err: any) {
      Alert.alert('Erreur de transmission', err.message || 'Impossible d enregistrer le signalement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Signaler une Anomalie</Text>
        <Text style={styles.subtitle}>
          Dépôt sauvage, encombrant ou décharge non autorisée à Dakar
        </Text>
      </View>

      {/* Description Field */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>1. Description du constat</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Ex: Important tas de gravats et sacs plastiques obstruant le trottoir..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Geolocation Section */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>2. Localisation (GPS ou Repère)</Text>
        
        <View style={styles.gpsRow}>
          <TouchableOpacity
            style={styles.gpsButton}
            onPress={handleGetLocation}
            disabled={locLoading}
          >
            {locLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.gpsButtonText}>📍 Obtenir ma position GPS</Text>
            )}
          </TouchableOpacity>

          {latitude != null && longitude != null && (
            <View style={styles.gpsResult}>
              <Text style={styles.gpsCoords}>
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </Text>
              <Text style={styles.gpsAccuracy}>Précision ~{Math.round(accuracy || 0)}m</Text>
            </View>
          )}
        </View>

        <Text style={styles.orText}>— OU REPÈRE TEXTUEL COMPLÉMENTAIRE —</Text>

        <TextInput
          style={styles.input}
          placeholder="Ex: Marché Sandaga, angle Rue Carnot / Émile Badiane"
          placeholderTextColor="#94a3b8"
          value={descriptionLoc}
          onChangeText={setDescriptionLoc}
        />
        {locationError && <Text style={styles.errorText}>{locationError}</Text>}
      </View>

      {/* Waste Categories (Multi-select) */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>3. Catégories de Déchets</Text>
        <Text style={styles.hint}>Sélectionnez une ou plusieurs catégories constatées :</Text>
        {typesError ? (
          <View>
            <Text style={styles.errorText}>{typesError}</Text>
            <TouchableOpacity onPress={() => void loadTypesDechets()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.chipsContainer}>
          {typesDechets.map((t) => {
            const isSelected = selectedTypes.includes(t.idTypeDechet);
            return (
              <TouchableOpacity
                key={t.idTypeDechet}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleCategory(t.idTypeDechet)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {isSelected ? '✓ ' : '+ '}
                  {t.libelle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Photo Capture */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>4. Photo / Preuve visuelle</Text>
        {photoUri ? (
          <View style={styles.photoPreviewBox}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => setPhotoUri(null)}
            >
              <Text style={styles.removePhotoText}>✕ Supprimer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActionsRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
              <Text style={styles.photoBtnText}>📷 Prendre Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickImage}>
              <Text style={styles.photoBtnText}>🖼 Choisir Galerie</Text>
            </TouchableOpacity>
          </View>
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
            {isOnline ? '🚀 Transmettre le Signalement' : '💾 Sauvegarder (Mode Hors-Ligne)'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 40,
    backgroundColor: '#f8fafc',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
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
  cardHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 11,
    marginTop: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  retryButtonText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700',
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
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gpsButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  gpsButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  gpsResult: {
    flex: 1,
  },
  gpsCoords: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  gpsAccuracy: {
    fontSize: 10,
    color: '#16a34a',
  },
  orText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#15803d',
    fontWeight: '700',
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  photoPreviewBox: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  removePhotoBtn: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  removePhotoText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#16a34a',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
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
