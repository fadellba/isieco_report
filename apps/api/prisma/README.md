# Prisma et migrations PostgreSQL

L'API utilise Prisma 7.10.1 avec le client généré dans
`src/generated/prisma` et l'adaptateur PostgreSQL `@prisma/adapter-pg`.
Les scripts `build`, `typecheck` et `test` régénèrent ce client avant leur
exécution. Une URL `DATABASE_URL` n'est nécessaire à la génération que si le
schéma ou les générateurs en dépendent ; les commandes de migration exigent une
URL configurée et ne possèdent pas de cible de repli.

Le schéma Prisma décrit les 36 tables relationnelles du modèle PostgreSQL,
y compris `contenu_signalement` pour les catégories déclarées par le citoyen.
Les contraintes `CHECK`, les index partiels, vues et déclencheurs restent
définis dans les migrations SQL, car Prisma ne les représente pas tous.
Les migrations doivent donc conserver ces objets et ne pas les remplacer par
un `prisma db push`.

## Correspondance métier et stockage

Le diagramme métier est conceptuel : `Localisation` est un objet-valeur dont
les attributs sont stockés dans les tables de signalement, de dossier et
d'historique, et non dans une table dédiée. `Session` et
`IdempotenceSignalement` sont des tables techniques nécessaires au backend,
pas de nouvelles entités métier.

Les quantités qualifiées d'un signalement ou d'un dossier sont stockées en
`NUMERIC(12,3)` avec une unité. Les estimations historiques libres sont
conservées dans `quantite_estimee_legacy` afin que leur migration n'efface
aucune information; les contrats API existants continuent de les exposer sous
forme de texte. Les quantités déclarées directement par un citoyen restent du
texte libre dans `contenu_signalement`, distinct de la qualification métier.

Prisma ne modélise pas les contraintes SQL `CHECK`; leur définition dans les
migrations et le SQL de référence est donc une partie du contrat de données,
notamment pour imposer une unité lorsque la quantité numérique est renseignée.

Le diagramme contient 36 classes : 35 entités relationnelles métier et
`Localisation`, un objet-valeur intégré aux signalements, dossiers et
historiques de localisation. Les 37 tables SQL et modèles Prisma comprennent
en plus `session` et `idempotence_signalement`, qui sont des mécanismes
techniques. Les noms UML et les noms de persistance diffèrent pour les
associations historisées et quelques classes de détail :

| Classe UML | Modèle Prisma | Table SQL |
| --- | --- | --- |
| `AttributionRole` | `UtilisateurRole` | `utilisateur_role` |
| `PreferenceVisibiliteCitoyen` | `PreferencesVisibiliteCitoyen` | `preferences_visibilite_citoyen` |
| `DelegationResponsabilite` | `DelegationDecisionEquipe` | `delegation_decision_equipe` |
| `HistoriqueDisponibilite` | `HistoriqueDisponibiliteEquipe` | `historique_disponibilite_equipe` |
| `CategorieDossier` | `ContenuDossier` | `contenu_dossier` |
| `ProvenanceCategorie` | `ProvenanceContenuDossier` | `provenance_contenu_dossier` |
| `HistoriquePriorite` | `HistoriquePrioriteDossier` | `historique_priorite_dossier` |
| `HistoriqueLocalisation` | `HistoriqueLocalisationDossier` | `historique_localisation_dossier` |
| `AttributionBadge` | `BadgeUtilisateur` | `badge_utilisateur` |

Les autres classes métier correspondent directement au modèle Prisma de même
nom et à sa table `snake_case`. Le lien entre `Signalement` et
`HistoriquePoints` est optionnel : les mouvements manuels et compensatoires
peuvent ne pas avoir de signalement d'origine. La priorité d'un dossier garde
les quatre valeurs convenues (`FAIBLE`, `MOYENNE`, `ELEVEE`, `URGENTE`); le
niveau de risque d'un volet est une donnée métier distincte.

## Vérification locale

Définir `DATABASE_URL` vers une base PostgreSQL dédiée, sans inscrire le secret
dans le dépôt, puis lancer :

```bash
npm --workspace=@isieco/api run prisma:validate
npm --workspace=@isieco/api run prisma:generate
```

La génération et la validation du schéma ont également été vérifiées sans
`DATABASE_URL`. Les migrations, elles, ne doivent être lancées qu'après avoir
configuré explicitement une base cible dédiée.

Pour vérifier l'alignement du modèle Prisma avec la base cible sans appliquer
de changement, lancer depuis `apps/api` :

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Un code de sortie `0` signifie qu'aucune différence dans le périmètre géré par
Prisma n'a été détectée. Les contraintes `CHECK`, index partiels, vues et
déclencheurs qui ne sont pas représentés par Prisma doivent en plus rester
vérifiés dans les migrations SQL versionnées ; ils ne sont pas couverts par ce
diff de modèle.

## Base vide

Sur une base de développement vide et explicitement dédiée, appliquer les
migrations SQL versionnées dans l'ordre (baseline et évolutions ultérieures) :

```bash
npm --workspace=@isieco/api run migrate:pg
```

La migration `20261023120000_hash_session_tokens` transforme les jetons de
session existants en empreintes SHA-256 sans révoquer les sessions actives.
Elle doit être déployée avant de lancer la version de l'API qui l'utilise.
`prisma migrate deploy` l'applique dans l'ordre ; ne l'exécutez pas directement
sur une base partagée sans sauvegarde vérifiée.

La migration `20261023140000_signalement_idempotency` ajoute le registre
d'idempotence des créations mobiles. Elle permet de renvoyer le même
signalement après une réponse réseau perdue et rejette une même clé réutilisée
avec un contenu différent. Elle doit également être appliquée avant le
déploiement de cette version de l'API.

La migration `20261023160000_quantites_normalisees` ajoute le stockage
numérique et l'unité des quantités qualifiées. Elle conserve les chaînes
existantes sans les convertir automatiquement, car elles peuvent contenir des
estimations qualitatives ou approximatives.

`prisma` est une dépendance de développement : les commandes de migration
doivent s'exécuter dans un job de déploiement isolé disposant des dépendances de
développement, pas dans l'image d'exécution de l'API.

## Base déjà utilisée

Ne pas exécuter la migration initiale ou `migrate:pg` sur une base existante
avant d'avoir contrôlé son schéma et créé une sauvegarde restaurable. Le
baseline ne supprime pas de tables, mais il crée les objets du modèle et
échouera si ces objets existent déjà. La migration historique
`src/db/migrations/001_full_system_schema.sql` est un script de réinitialisation
et ne doit jamais être rejouée sur des données à conserver.

L'adoption d'une base existante requiert une comparaison du schéma réel avec le
baseline, puis une décision de baseline Prisma ou une migration additive
spécifique. Aucune base existante n'est automatiquement marquée comme migrée
par le code ou les scripts du projet.
