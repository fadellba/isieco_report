import React, { useState } from 'react';
import { RoleCode, UserProfile } from '@isieco/shared';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

const ROLE_LABELS: Record<RoleCode, string> = {
  [RoleCode.CITOYEN]: 'Citoyen',
  [RoleCode.QUALIFICATION]: 'Qualification',
  [RoleCode.TRAITEMENT]: 'Traitement',
  [RoleCode.AFFECTATION]: 'Affectation',
  [RoleCode.TERRAIN]: 'Interventions terrain',
  [RoleCode.VERIFICATION]: 'Vérification',
  [RoleCode.ADMIN]: 'Administration',
  [RoleCode.DECISION]: 'Décision territoriale',
};

type Feedback = { kind: 'success' | 'error'; message: string } | null;

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [nom, setNom] = useState(user?.nom ?? '');
  const [prenom, setPrenom] = useState(user?.prenom ?? '');
  const [telephone, setTelephone] = useState(user?.telephone ?? '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  if (!user) return null;

  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileLoading(true);
    setProfileFeedback(null);
    try {
      const response = await api.patch<{ success: boolean; user: UserProfile }>('/auth/me', {
        nom,
        prenom: prenom || null,
        telephone: telephone || null,
      });
      updateUser(response.user);
      setProfileFeedback({ kind: 'success', message: 'Votre profil a été mis à jour.' });
    } catch (error) {
      setProfileFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'La mise à jour du profil a échoué.',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordFeedback(null);
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ kind: 'error', message: 'La confirmation ne correspond pas au nouveau mot de passe.' });
      return;
    }
    if (newPassword.length < 12) {
      setPasswordFeedback({ kind: 'error', message: 'Le nouveau mot de passe doit contenir au moins 12 caractères.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await api.patch<{ success: boolean; message: string }>('/auth/password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ kind: 'success', message: response.message });
    } catch (error) {
      setPasswordFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Le changement de mot de passe a échoué.',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const initials = `${user.prenom?.[0] ?? ''}${user.nom[0] ?? ''}`.toUpperCase();

  return (
    <section className="settings-page">
      <header className="settings-heading">
        <div>
          <div className="ops-eyebrow"><span /> COMPTE & PRÉFÉRENCES</div>
          <h1>Mon profil</h1>
          <p>Gérez vos informations personnelles et la sécurité de votre accès.</p>
        </div>
        <span className="settings-account-state"><i /> COMPTE ACTIF</span>
      </header>

      <div className="settings-layout">
        <aside className="settings-summary">
          <div className="settings-avatar">{initials || <UserRound size={28} />}</div>
          <h2>{user.prenom ? `${user.prenom} ${user.nom}` : user.nom}</h2>
          <p>{user.email}</p>
          <div className="settings-divider" />
          <div className="settings-fact">
            <Mail size={15} /><span>Adresse e-mail</span><strong>{user.email}</strong>
          </div>
          <div className="settings-fact">
            <CalendarDays size={15} /><span>Membre depuis</span>
            <strong>
              {user.dateInscription
                ? new Date(user.dateInscription).toLocaleDateString('fr-SN', { dateStyle: 'long' })
                : 'Information indisponible'}
            </strong>
          </div>
          <div className="settings-fact">
            <ShieldCheck size={15} /><span>Habilitations actives</span>
            <div className="settings-roles">
              {user.roles.map((role) => (
                <span key={role}>{ROLE_LABELS[role]}</span>
              ))}
            </div>
          </div>
          <div className="settings-note">
            <BadgeCheck size={15} />
            <span>Les habilitations sont gérées par l’administration. Elles ne peuvent pas être modifiées depuis votre profil.</span>
          </div>
        </aside>

        <div className="settings-panels">
          <article className="settings-card">
            <div className="settings-card__heading">
              <span className="settings-icon"><UserRound size={17} /></span>
              <div><h2>Informations personnelles</h2><p>Ces informations sont visibles par votre équipe.</p></div>
            </div>
            <form onSubmit={submitProfile} className="settings-form">
              <div className="settings-form__row">
                <label>
                  Prénom
                  <input maxLength={100} value={prenom} onChange={(event) => setPrenom(event.target.value)} autoComplete="given-name" />
                </label>
                <label>
                  Nom
                  <input maxLength={100} value={nom} onChange={(event) => setNom(event.target.value)} autoComplete="family-name" required />
                </label>
              </div>
              <div className="settings-form__row">
                <label>
                  E-mail de connexion
                  <input value={user.email} disabled readOnly />
                  <small>Contactez un administrateur pour modifier votre adresse.</small>
                </label>
                <label>
                  Téléphone
                  <input maxLength={50} type="tel" value={telephone} onChange={(event) => setTelephone(event.target.value)} autoComplete="tel" placeholder="+221 77 000 00 00" />
                </label>
              </div>
              {profileFeedback && <p className={`settings-feedback settings-feedback--${profileFeedback.kind}`} role="status">{profileFeedback.message}</p>}
              <div className="settings-form__actions">
                <button className="settings-primary-button" type="submit" disabled={profileLoading || !nom.trim()}>
                  {profileLoading ? <span className="settings-spinner" /> : <Save size={15} />}
                  Enregistrer le profil
                </button>
              </div>
            </form>
          </article>

          <article className="settings-card">
            <div className="settings-card__heading">
              <span className="settings-icon settings-icon--blue"><LockKeyhole size={17} /></span>
              <div><h2>Mot de passe & sécurité</h2><p>Un nouveau mot de passe ferme vos autres sessions.</p></div>
            </div>
            <form onSubmit={submitPassword} className="settings-form">
              <label>
                Mot de passe actuel
                <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </label>
              <div className="settings-form__row">
                <label>
                  Nouveau mot de passe
                  <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
                  <small>12 caractères minimum.</small>
                </label>
                <label>
                  Confirmer le nouveau mot de passe
                  <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                </label>
              </div>
              {passwordFeedback && <p className={`settings-feedback settings-feedback--${passwordFeedback.kind}`} role="status">{passwordFeedback.message}</p>}
              <div className="settings-form__actions">
                <button className="settings-primary-button" type="submit" disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}>
                  {passwordLoading ? <span className="settings-spinner" /> : <KeyRound size={15} />}
                  Mettre à jour le mot de passe
                </button>
              </div>
            </form>
          </article>
        </div>
      </div>
    </section>
  );
};
