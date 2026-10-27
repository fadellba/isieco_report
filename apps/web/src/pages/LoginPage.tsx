import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Recycle,
  ShieldCheck,
} from 'lucide-react';
import './login.css';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Connexion impossible. Vérifiez vos identifiants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen">
      <div className="login-shell">
        <section className="login-hero" aria-label="Mission environnementale">
          <img
            className="login-hero__photo"
            src="/images/waste-plastic-bottles.jpg"
            alt="Agents de collecte chargent des déchets dans un camion"
          />
          <div className="login-hero__scrim" />
          <div className="login-brand">
            <span className="login-brand__mark"><Leaf size={21} /></span>
            <span><strong>ISI-Eco Report</strong><small>OBSERVATOIRE DE LA SALUBRITÉ URBAINE</small></span>
          </div>
          <div className="login-hero__copy">
            <span className="login-kicker"><i /> PLATEFORME ENVIRONNEMENTALE · DAKAR</span>
            <h1>Un signalement.<br />Un quartier plus propre.</h1>
            <p>
              La plateforme communale de signalement des dépôts sauvages, de suivi des interventions et de protection du cadre de vie.
            </p>
            <div className="login-hero__pill">
              <Recycle size={16} />
              <span>Du terrain à la résolution, chaque action est suivie.</span>
            </div>
          </div>
          <div className="login-photo-credit">
            <span>Photo d'illustration · Abeokuta, Nigeria</span>
            <a
              href="https://commons.wikimedia.org/wiki/File:Waste_Plastic_Bottles.jpg"
              target="_blank"
              rel="noreferrer"
            >
              Lanrupacoco · Wikimedia Commons · CC BY-SA 4.0
            </a>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel__top">
            <span className="login-secure"><LockKeyhole size={13} /> ACCÈS SÉCURISÉ</span>
            <span className="login-panel__location">DAKAR, SÉNÉGAL</span>
          </div>

          <div className="login-panel__content">
            <span className="login-kicker login-kicker--green">ESPACE AGENTS &amp; ADMINISTRATION</span>
            <h2 id="login-title">Bienvenue dans votre centre de suivi.</h2>
            <p className="login-panel__intro">Connectez-vous pour qualifier les signalements et piloter les opérations de salubrité.</p>

            {error && (
              <div className="login-error" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                Adresse e-mail
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nom@isieco.sn"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                <span className="login-password-label">Mot de passe</span>
                <span className="login-password-field">
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Saisissez votre mot de passe"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? 'Connexion en cours…' : 'Ouvrir ma session'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          </div>

          <footer className="login-panel__footer">
            <span><ShieldCheck size={13} /> Sessions protégées par cookie HttpOnly</span>
            <span>ISI-Eco Report · Dakar</span>
          </footer>
        </section>
      </div>
    </main>
  );
};
