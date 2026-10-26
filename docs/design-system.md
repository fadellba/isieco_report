# Design system — ISI-Eco Report

**Version :** 0.2  
**Statut :** direction visuelle validée ; tokens et premiers écrans citoyen intégrés progressivement  
**Périmètre :** application mobile citoyen/terrain et portail web métier

## 1. Intention

Concevoir une interface publique claire, calme et digne de confiance, adaptée aux usages de signalement environnemental à Dakar. Le système visuel est commun aux applications web et mobile, mais ne les force pas à partager leurs composants de navigation : les outils et contraintes des plateformes restent différents.

### Principes

1. **Le service avant la décoration.** Les actions principales, l'état d'un dossier et la prochaine étape doivent être immédiatement compréhensibles.
2. **La couleur a un sens stable.** Les couleurs nationales apportent l'identité de marque ; les couleurs de succès, avertissement et erreur gardent leur sens fonctionnel.
3. **La simplicité pour tous.** Français clair, hiérarchie lisible, contrastes contrôlés, interactions accessibles et fonctionnement adapté aux connexions mobiles irrégulières.
4. **Même langage, interfaces adaptées.** Tokens sémantiques et règles partagés ; navigation et composants spécifiques aux capacités web/mobile.
5. **Pas d'état uniquement visuel.** Un statut est toujours annoncé par un libellé et, si utile, une icône, pas seulement par une couleur.
6. **Intuitivité sur toute la plateforme.** Chaque écran doit rendre son objectif, l'action principale et son résultat compréhensibles sans formation préalable, quel que soit le rôle ou le terminal.

### Règle d'intuitivité pour chaque écran

Un écran n'est pas considéré comme clair s'il est seulement esthétique ou conforme aux couleurs. Il doit répondre, dans l'ordre de lecture naturel, à ces questions :

1. **Où suis-je ?** Un titre et un contexte identifient l'espace, le dossier ou la tâche.
2. **Que puis-je faire ici ?** Une action principale visible est nommée avec un verbe concret ; les actions secondaires sont hiérarchisées.
3. **De quoi ai-je besoin ?** Les prérequis, champs requis, formats, permissions et conséquences sont expliqués avant l'action, au moment utile.
4. **Que vient-il de se passer ?** Chargement, succès, attente, erreur, sauvegarde locale ou refus sont confirmés sans ambiguïté.
5. **Quelle est la prochaine étape ?** Après une action métier, l'écran indique l'étape suivante ou la manière de reprendre.

Principes applicables à l'ensemble des écrans :

- Utiliser les mêmes termes pour un même objet ou statut dans les menus, formulaires, listes, notifications et messages ; éviter les acronymes internes ou les expliciter.
- Afficher progressivement les options avancées ; ne pas surcharger l'écran initial d'informations rarement utiles.
- Garder la navigation, les actions de retour, la recherche et les filtres prévisibles. Préserver le contexte et les données saisies lorsqu'on revient d'une erreur récupérable.
- Montrer les données et actions selon le rôle, avec un texte qui explique les actions indisponibles lorsque cela aide ; ne jamais laisser croire qu'une dissimulation frontale constitue une autorisation.
- Demander confirmation avant une action destructive ou difficilement réversible, avec l'objet et l'effet clairement nommés. Ne pas ajouter de confirmation aux actions ordinaires qui peuvent être annulées.
- Réduire la saisie au nécessaire, réutiliser les données déjà connues de manière transparente et proposer des valeurs/contextes adaptés sans présélectionner silencieusement une décision métier.
- Pour les flux hors ligne, distinguer « enregistré sur cet appareil », « en attente d'envoi », « reçu par le serveur » et « traité » ; ne pas présenter une mise en file locale comme une réussite serveur.
- Pour une erreur, expliquer en langage utilisateur ce qui a échoué, préserver les données et offrir une action de reprise quand elle existe.
- Les listes et tableaux répondent clairement aux états « chargement », « aucun résultat », « aucun élément créé », « erreur » et « résultats filtrés ».

### Parcours essentiels par rôle

La clarté doit être évaluée sur les chaînes complètes de tâches, et pas seulement écran par écran :

- **Citoyen :** se connecter → créer un signalement → comprendre s'il est sauvegardé localement ou reçu → retrouver le suivi → répondre à un complément si nécessaire.
- **Administration :** trouver une demande/personne/référentiel → comprendre son état et ses conséquences → agir selon ses droits → retrouver la trace du changement.
- **Agent de terrain :** ouvrir la mission attribuée → voir priorité, lieu et prérequis → démarrer → saisir résultat et preuves → comprendre la transmission et le prochain contrôle.

Pour chaque parcours, prévoir un chemin nominal, un retour en arrière, une erreur récupérable, un état vide et une interruption réseau pertinente.

## 2. Identité et couleurs nationales

Le vert est la couleur fonctionnelle principale. Le jaune est un accent de marque et d'attention. Le rouge du drapeau est réservé aux accents de marque non interactifs ; les erreurs et actions dangereuses utilisent un rouge sémantique distinct, nommé selon sa fonction.

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| `background` | `#F6F8F5` | `#0B1510` | Fond général des écrans |
| `surface` | `#FFFFFF` | `#111E16` | Cartes, formulaires, panneaux |
| `surface-raised` | `#FFFFFF` | `#18251D` | Menus, feuilles et contenus en surélévation |
| `text-primary` | `#17231B` | `#F1F5F2` | Titres et contenu principal |
| `text-secondary` | `#526056` | `#A8B5AC` | Aide, métadonnées et texte secondaire |
| `border` | `#D7E0D8` | `#34443A` | Délimitations non porteuses d'information |
| `primary` | `#087443` | `#4ADE80` | Actions, liens et sélection principale |
| `on-primary` | `#FFFFFF` | `#0B1510` | Texte/icônes sur l'action principale |
| `primary-subtle` | `#EAF5ED` | `#14251B` | Fond doux d'une sélection ou d'un état positif |
| `brand-green` | `#00853F` | `#48C58B` | Signature, illustration et détails de marque |
| `brand-yellow` | `#FDEF42` | `#FDEF42` | Accent de marque, repère ou petite surface dédiée |
| `brand-red` | `#E31B23` | `#E31B23` | Trait, motif ou détail de marque non fonctionnel |
| `success` | `#166534` | `#4ADE80` | État positif confirmé |
| `success-surface` | `#EAF5ED` | `#14251B` | Fond d’un état positif |
| `warning` | `#422006` | `#FCD34D` | Avertissement, à associer à un fond de statut distinct |
| `warning-surface` | `#FEF7D1` | `#2B2418` | Fond d’un avertissement |
| `danger` | `#B42318` | `#FDA29B` | Erreur, refus ou action destructive |
| `danger-surface` | `#FEF2F1` | `#321D1B` | Fond d’une erreur ou d’un état dangereux |
| `info` | `#155E75` | `#7DD3FC` | Information neutre |
| `info-surface` | `#E8F4F8` | `#172A30` | Fond d’une information neutre |

Les variantes de fond des états sont définies séparément de leurs premiers plans afin de maintenir un contraste lisible. Le jaune vif et le rouge du drapeau ne seront pas utilisés comme texte courant ou comme couleurs de bouton sur une grande surface sans vérification de contraste.

### Contrastes mesurés pour les paires proposées

Ratios calculés selon la formule de luminance WCAG 2.1 ; les paires ci-dessous dépassent 4,5:1 pour du texte courant :

| Premier plan / arrière-plan | Ratio | Emploi recommandé |
|---|---:|---|
| `#087443` / `#FFFFFF` | 5,85:1 | Libellé de bouton principal clair |
| `#087443` / `#F6F8F5` | 5,48:1 | Lien ou action sur fond général clair |
| `#17231B` / `#F6F8F5` | 15,21:1 | Texte principal clair |
| `#526056` / `#F6F8F5` | 6,21:1 | Texte secondaire clair |
| `#00853F` / `#FFFFFF` | 4,74:1 | Marque verte sur blanc ; garder les tailles lisibles |
| `#166534` / `#EAF5ED` | 6,38:1 | Texte d’état positif clair |
| `#422006` / `#FEF7D1` | 13,49:1 | Texte d’avertissement clair |
| `#B42318` / `#FEF2F1` | 6,01:1 | Message d'erreur sur fond d'erreur doux |
| `#155E75` / `#E8F4F8` | 6,48:1 | Texte d’information clair |
| `#422006` / `#FDEF42` | 12,22:1 | Texte foncé sur accent jaune |
| `#F1F5F2` / `#0B1510` | 16,90:1 | Texte principal sombre |
| `#A8B5AC` / `#0B1510` | 8,74:1 | Texte secondaire sombre |
| `#4ADE80` / `#14251B` | 9,20:1 | Texte d’état positif sombre |
| `#FCD34D` / `#2B2418` | 10,64:1 | Texte d’avertissement sombre |
| `#FDA29B` / `#321D1B` | 8,15:1 | Texte d’erreur sombre |
| `#7DD3FC` / `#172A30` | 8,93:1 | Texte d’information sombre |
| `#0B1510` / `#4ADE80` | 10,67:1 | Texte sur accent/action verte sombre |

Ces résultats valident ces paires de couleurs, pas automatiquement toutes les opacités, états hover/disabled, tailles de texte ni contrastes d'éléments non textuels. Le contrôle visuel et automatisé reste nécessaire sur les écrans réels.

### Règles d'usage des couleurs

- Réserver le vert principal aux actions prioritaires, aux liens et à la sélection active ; éviter de colorer toutes les surfaces en vert.
- Utiliser le jaune par touches : accent de marque, repère d'attention ou illustration. Un avertissement métier garde un libellé explicite et une couleur fonctionnelle validée.
- Ne pas utiliser le rouge national comme code d'erreur : le rouge sémantique `danger` porte les messages d'erreur, refus et confirmations d'action destructive.
- Ne pas coder les rôles (citoyen, administration, terrain) par une couleur distincte. Utiliser nom, icône et contexte.
- Les statuts métier conservent des libellés humains stables et un marqueur textuel/icône ; ne pas les renommer pour des raisons de couleur.
- La photographie, la carte et les graphiques ne doivent pas rendre le texte illisible ; prévoir une surface opaque ou un scrim contrôlé derrière le contenu superposé.

## 3. Modes de thème

- Valeur initiale : suivre le thème système (`system`), clair ou sombre.
- Prévoir un choix utilisateur `light`, `dark` ou `system` dans les préférences.
- Le choix explicite de l'utilisateur prime sur la préférence système ; `system` revient au thème OS. Persister la préférence localement.
- Changer de thème sans rechargement et sans perdre l'état de saisie ou de navigation.
- Utiliser des tokens sémantiques, jamais des hexadécimaux dispersés dans les écrans.
- Vérifier en mode sombre les cartes, erreurs, cartes géographiques, dialogues, états désactivés et contenus médias ; ne pas inverser naïvement toute la palette.

## 4. Typographie

- Police de référence : **Inter** pour l'interface lorsque disponible, avec une pile sans-serif système de repli. Ne pas ajouter de police ou dépendance avant vérification de son chargement et de son poids sur mobile.
- Le web et le mobile doivent partager l'échelle et les graisses, pas nécessairement le même moteur de rendu.
- Échelle de référence : `12` métadonnée, `14` secondaire/contrôle dense, `16` corps, `20` titre de section, `24` titre d'écran, `32` titre de mise en avant.
- Corps et consignes : hauteur de ligne confortable (environ 1,45–1,6) ; éviter les paragraphes longs et les capitales prolongées.
- Les libellés restent courts, explicites et orientés action. Ne pas utiliser une taille inférieure à 12 px pour de l'information nécessaire au parcours.
- Respecter le redimensionnement du texte du système sur mobile et la mise en page fluide sur le web.

## 5. Forme, densité et mise en page

- Espacements basés sur une unité de 4 px, avec une échelle privilégiée de 4/8/12/16/24/32.
- Rayon : 8 px pour champs et petites commandes, 12 px pour cartes, 16 px pour panneaux/drawers. Éviter l'arrondi intégral hors pastilles.
- Bordure fine et discrète pour distinguer les surfaces ; ombre légère réservée aux éléments réellement superposés.
- Préférer une hiérarchie de surfaces, espacements et titres à des bordures autour de chaque élément.
- Contenu mobile en une colonne avec zones tactiles d'au moins 44 × 44 dp ; écran large avec contenu contraint et navigation latérale.
- Ne pas compresser les formulaires métier dans des grilles étroites ; conserver une largeur lisible et un ordre vertical prévisible.

## 6. Composants de base

Les composants ci-dessous constituent le vocabulaire initial. Ils sont à implémenter dans les conventions natives de chaque application, pas dans une couche de composants partagée forcée.

### Boutons

- `primary` : une action principale par zone (ex. « Envoyer le signalement »).
- `secondary` : action utile mais non prioritaire.
- `tertiary` : action discrète, souvent textuelle.
- `danger` : action destructive avec libellé explicite et confirmation lorsque l'effet métier est irréversible.
- États obligatoires : repos, pressé/hover, focus visible, chargement, désactivé. Conserver une largeur et une structure stables en chargement.
- Verbe d'action concret ; éviter les libellés seuls « OK » ou « Valider » lorsque l'effet peut être nommé.

### Champs et formulaires

- Label persistant au-dessus ou associé au champ ; ne jamais utiliser le placeholder comme unique label.
- Texte d'aide associé au champ ; erreur contextualisée, annoncée et reliée au champ.
- Distinguer erreur de validation, erreur serveur, indisponibilité réseau et valeur sauvegardée hors ligne.
- Préserver les valeurs saisies après une erreur récupérable.
- Les champs requis et le format attendu sont signalés avant soumission ; les règles serveur restent la source d'autorité.

### Cartes et listes

- Une carte représente un objet/action cohérent et expose un titre, l'information utile, l'état et l'action secondaire éventuelle.
- Les lignes de signalement privilégient référence/date, résumé, étape courante et action de suivi.
- Éviter des cartes imbriquées ; une zone cliquable a une indication de focus et un libellé accessible explicite.

### Badges et statuts

- Libellé métier complet ou court mais non ambigu, accompagné d'une couleur de fond/texte contrôlée et, si utile, d'une icône.
- Les états en attente, en traitement, acceptés, refusés, clos et hors ligne sont distingués par texte et forme/icône en plus de la couleur.
- Une modification de statut explique si nécessaire ce qui vient de se passer et la prochaine étape.

### Feedback, dialogues et notifications

- Prévoir les états de chargement, vide, erreur, succès, absence de réseau et données périmées.
- Un message de succès confirme l'action accomplie. Une erreur explique le problème et propose la prochaine action quand elle existe.
- Les erreurs persistantes utilisent un rôle d'annonce accessible ; éviter les alertes bloquantes pour les retours ordinaires.
- Un dialogue sert aux décisions nécessitant contexte ou confirmation, pas aux formulaires longs.

### Navigation

- **Mobile citoyen/terrain :** navigation inférieure pour les destinations principales, action de signalement mise en évidence sans cacher les autres onglets ; détails et formulaires par piles d'écrans.
- **Web métier/administration :** en-tête et navigation latérale filtrée selon les rôles retournés par l'API ; la visibilité UI ne remplace jamais l'autorisation backend.
- Conserver titre de destination, retour cohérent et état actif textuellement/intelligiblement identifié.
- Les paramètres de thème et de profil sont accessibles depuis un point stable dans les deux applications.

## 7. Accessibilité et interaction

- Viser WCAG 2.2 niveau AA pour le web et les principes équivalents de plateforme sur mobile.
- Navigation clavier complète sur le web ; ordre de focus logique, focus visible, retour au déclencheur après fermeture d'un dialogue.
- Noms accessibles pour boutons à icône, annonces des changements de statut, labels/erreurs associés aux champs et hiérarchie de titres correcte.
- Cibles tactiles d'au moins 44 × 44 dp sur mobile ; espacement évitant les activations accidentelles.
- Contraste minimal WCAG pour le texte : 4,5:1 en texte courant, 3:1 en grand texte ; éléments interactifs et limites graphiques essentiels contrôlés séparément à 3:1.
- Ne jamais utiliser la couleur, le son, le mouvement ou la position comme unique canal d'information.
- Respecter la réduction des animations ; animations courtes et informatives uniquement.
- Tester le zoom, le texte agrandi, les lecteurs d'écran, le mode sombre et les contrastes sur les écrans réels.

## 8. Application aux parcours métier

### Citoyen — priorité produit

1. Connexion, récupération de compte si le contrat API est disponible, et gestion des erreurs/session.
2. Création d'un signalement : catégorie, localisation GPS ou repère textuel, description et photo avec permissions et alternatives explicites.
3. Mes signalements : liste, détail, état compréhensible, demande/réponse de complément, notifications et reprise hors ligne.
4. Profil, préférences de thème et paramètres de session.

La contribution citoyenne doit distinguer clairement un brouillon local hors ligne d'un signalement effectivement reçu par le serveur. Après envoi, présenter la référence et l'étape suivante sans laisser entendre qu'une résolution a été confirmée.

### Administration

Réutiliser les mêmes tokens et composants de formulaire/tableau/état ; privilégier une densité de données maîtrisée, les filtres explicites, la confirmation des changements sensibles et les traces d'audit. Les actions sont regroupées par tâche métier et les termes d'interface décrivent les conséquences, sans exposer inutilement la structure interne de l'API ou de la base.

### Agent de terrain

Réutiliser les mêmes tokens et statuts ; optimiser l'usage en mobilité et sur site : missions, priorités explicites, progression d'intervention, saisie de compte rendu, photos et retours réseau clairs. Les actions les plus fréquentes sont accessibles sans navigation profonde ; les champs et contrôles tiennent compte d'un usage à une main et des interruptions terrain.

## 9. Contraintes produit et API relevées

- L'API expose la connexion, la déconnexion, le profil courant et sa modification, et le changement de mot de passe.
- **Aucune route d'inscription publique n'a été repérée** dans les routes d'authentification inspectées. La création d'utilisateurs identifiée est une capacité d'administration, pas un flux d'inscription citoyenne. Avant de concevoir une inscription, il faut décider si le compte citoyen est précréé, créé par un opérateur ou si une API d'inscription doit être spécifiée et sécurisée.
- L'application mobile existante inclut onboarding, connexion, signalement, suivi, points, notifications, profil et parcours terrain. Le portail web inclut un espace métier/admin.
- Le code existant est majoritairement sombre et contient plusieurs couleurs codées en dur. La présente proposition introduit une direction cible claire avec mode sombre associé ; elle ne prétend pas que ces thèmes sont déjà implémentés.
- L'ordre demandé est conservé : citoyen, puis administration, puis agent de terrain. Cela n'empêche pas de valider tôt les composants communs dans les deux clients.

## 10. Critères avant implémentation

- Palette et noms sémantiques validés, paires principales de contrastes mesurées.
- Parcours d'inscription clarifié au niveau produit/API avant de promettre un écran d'inscription opérationnel.
- Représentation des états métier, erreurs, chargements, hors-ligne et retours confirmés définie.
- Une maquette ou un prototype représentatif au moins pour connexion, nouveau signalement et suivi citoyen, en clair et sombre, avant migration visuelle étendue.
- Pour chaque parcours prioritaire, objectifs de l'écran, action principale, prérequis, retours d'état et prochaine étape définis, y compris pour l'administration et le terrain.
- Vérifier l'intuitivité avec des scénarios de tâche : une personne qui découvre la plateforme doit pouvoir choisir la bonne action, comprendre les termes et distinguer un succès réel d'une attente ou d'un échec. Recueillir erreurs et hésitations, puis ajuster navigation et libellés avant extension aux écrans suivants.
- Couvrir au minimum les états de chargement, vide, erreur récupérable, succès, refus d'autorisation, interruption réseau et confirmation destructive lorsqu'applicables.
- Après validation : implémenter d'abord les tokens et un petit ensemble de composants, puis migrer un parcours citoyen bout en bout avant de poursuivre les lots administration et terrain.

## 11. Exemple de composition — nouveau signalement

1. Titre « Nouveau signalement » avec phrase d'aide courte.
2. Bloc localisation : action « Utiliser ma position » et champ alternatif « Décrire un repère », permission GPS facultative et message d'erreur récupérable.
3. Sélection d'une ou plusieurs catégories avec sélection visible autrement que par la seule couleur.
4. Description, ajout de photo et explication claire si le réseau est absent.
5. Résumé de ce qui sera transmis ; action principale « Envoyer le signalement » avec état de chargement.
6. Confirmation serveur avec référence et statut « Reçu / en attente d'examen » ; en mode hors ligne, confirmation distincte « Enregistré sur cet appareil — en attente d'envoi ».
