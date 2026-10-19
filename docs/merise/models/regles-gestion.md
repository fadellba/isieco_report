---
title: Règles de gestion
project: ISI-Eco Report
version: 2.10
status: Règles cibles proposées — confirmation métier requise
---

# Règles de gestion

Les règles suivantes rendent le modèle v2.8 cohérent. Elles constituent des règles cibles de conception, et non la preuve que l’organisation pilote applique déjà ces pratiques. Les règles qui exigent une décision du partenaire sont rappelées dans `decisions-conception.md`.

## 1. Comptes, rôles et responsabilités

### RG1 — Identité du compte
Chaque compte possède un identifiant unique. Les champs d’identité collectés doivent être limités à ce qui est nécessaire au service.

### RG2 — Attribution d’un rôle
Un utilisateur doit disposer d’au moins un rôle valide pour accéder aux fonctions authentifiées. Les rôles et leurs périodes d’attribution sont conservés. Le cumul de rôles doit être autorisé explicitement.

### RG3 — Autorisation vérifiée
Toute action protégée est autorisée côté système selon le rôle, les permissions et, lorsque nécessaire, l’appartenance à une équipe. Un rôle affiché dans l’interface ne suffit pas à prouver une compétence ou un mandat métier.

### RG4 — Historique d’attribution de rôle
Une modification de rôle est attribuée à un acteur autorisé, horodatée et justifiée lorsque cela affecte les droits. L’attribution précédente n’est pas supprimée silencieusement.

### RG5 — Inscription des signalements
Dans le prototype académique, un signalement est rattaché à un compte. Un parcours sans compte n’est pas inclus dans le périmètre initial ; ce choix ne doit pas être présenté comme une règle universelle de service public.

### RG6 — Auteur d’origine
Un signalement conserve l’utilisateur qui l’a soumis. La correction de la description ou le rattachement à un dossier ne remplace pas son auteur initial.

## 2. Signalements et preuves initiales

### RG7 — Observation indépendante
Un signalement représente l’observation transmise par une personne, pas automatiquement une mission de nettoyage.

### RG8 — Dates distinctes
`dateConstat` représente le moment où la personne affirme avoir observé la situation, s’il est connu. `dateSoumission` est la date de réception effective par le système. Elles ne sont jamais interchangeables.

### RG9 — Localisation flexible
Les coordonnées peuvent être absentes lors de la soumission. Si elles manquent, une description de lieu ou un repère doit être enregistré pour que l’observation puisse être qualifiée. Les coordonnées sont fournies par paire et leur précision, si connue, est conservée.

### RG10 — Localisation opérationnelle
Un dossier ne peut être affecté tant que l’emplacement n’est pas suffisamment exploitable pour l’équipe concernée. Le niveau de précision demandé dépend du territoire, du type de mission et du risque.

### RG11 — Description et données incomplètes
Une observation doit contenir assez d’informations pour justifier sa réception. Les champs obligatoires du formulaire doivent être décidés et testés ; un contenu incomplet est marqué comme tel au lieu d’être déclaré automatiquement faux.

### RG12 — Photos facultatives
Les photographies ne sont pas obligatoires par défaut. Toute photographie appartient à un seul signalement ou à une seule intervention et respecte les règles d’accès, de masquage, de conservation et de suppression applicables.

### RG13 — Type de déchet déclaré
Un signalement peut contenir zéro ou plusieurs catégories initiales. Une ligne unique est conservée par couple signalement/catégorie ; le même type ne doit pas être dupliqué dans un signalement. Ces catégories reflètent une déclaration ou une première observation, non nécessairement une qualification officielle.

### RG14 — Catégories contrôlées
Chaque type de déchet possède un code et une définition compréhensible. Les catégories et les cas qui relèvent d’un service spécialisé sont validés par un responsable métier habilité.

### RG15 — Décision sur un signalement
Chaque observation reçue pour traitement est examinée selon une décision traçable : acceptée pour rattachement ou rejetée, ou renvoyée pour complément si le processus l’autorise. Toute décision conserve son acteur, sa date et son motif lorsqu’il est nécessaire.

### RG16 — Rejet non destructif
Un rejet ne supprime pas l’observation ni ses preuves. Le motif est conservé selon la politique de visibilité, et le citoyen reçoit une explication adaptée si la procédure le prévoit.

## 3. Rapprochement et dossier opérationnel

### RG17 — Dossier distinct
Un dossier de traitement représente une situation opérationnelle que le service accepte de prendre en charge. Il peut être créé à partir d’une ou plusieurs observations qualifiées ou d’une autre source autorisée.

### RG18 — Rattachement historique
Une observation peut être liée à zéro ou un dossier actif à un moment donné. Tous les rattachements passés restent consultables avec leur date, leur auteur, leur type et le motif pertinent.

### RG19 — Rapprochement sans perte
Le rapprochement de deux observations ne supprime ni n’écrase les signalements initiaux. Les éléments communs peuvent alimenter le dossier, tandis que la provenance de chaque donnée reste identifiable.

### RG20 — Correction d’un mauvais rapprochement
Un rattachement erroné peut être terminé et remplacé par un autre avec une justification et une trace. Le système ne transforme pas une fusion erronée en effacement d’historique.

### RG21 — Dossier unique pour un même cas connu
Lorsque plusieurs observations sont confirmées comme relatives au même dépôt ou à la même situation, elles doivent être rapprochées du même dossier actif, sauf raison métier documentée. Le critère de rapprochement ne repose pas uniquement sur des coordonnées arrondies.

### RG22 — Réapparition
Si un dépôt réapparaît après résolution, l’organisme décide si une nouvelle observation réouvre le dossier antérieur ou crée un nouveau dossier. La décision doit préserver à la fois l’historique précédent et la nouvelle situation.

### RG23 — Périmètre de prise en charge et transfert externe
Tout dossier traité doit relever du périmètre fonctionnel du système et être validé par un responsable habilité avant affectation. Un cas hors périmètre ne doit pas être affecté arbitrairement : la décision de mise en attente ou de transfert externe est tracée. Pour un transfert, un événement lié au dossier conserve le libellé du destinataire, l’acteur, la date et le motif ; le modèle ne gère pas les étapes internes du destinataire.

### RG24 — Priorité
La priorité est attribuée selon des critères partagés et maintenus par un responsable métier habilité. Toute modification de priorité est horodatée et conserve sa justification lorsqu’elle est requise.

### RG25 — Cas à risque ou nécessitant une orientation spécialisée
Un dossier impliquant des déchets potentiellement dangereux ou une catégorie spécialisée n’est pas affecté à une équipe sans compétence valide pour la catégorie concernée. Si aucun circuit compétent n’est défini dans le scénario, le dossier est mis en attente avec un motif plutôt que d’être affecté arbitrairement.

## 4. Organisation, équipes et compétences

### RG26 — Périmètre applicatif unique
Le scénario académique utilise un seul périmètre applicatif fictif. Aucune entité `ORGANISATION` ni aucun rattachement organisationnel des comptes ou des équipes n’est stocké. Cela ne constitue pas une désignation d’un opérateur réel ni un mandat de prise en charge au Sénégal.

### RG27 — Appartenance d’équipe
Une appartenance à une équipe concerne un agent habilité, possède une date de début et peut posséder une date de fin. L’historique n’est pas supprimé lorsqu’un agent change d’équipe.

### RG28 — Compétence par catégorie de déchets
Une équipe peut avoir une compétence valide pour plusieurs catégories de déchets ; chaque catégorie peut être prise en charge par plusieurs équipes. Les compétences sont gérées dans le référentiel `COMPETENCE_EQUIPE`, avec dates de validité et trace des changements.

### RG29 — Localisation et affectation
Les coordonnées GPS servent à localiser le dépôt et à aider le responsable à examiner le dossier. Elles ne déterminent pas automatiquement une autorité compétente ni l’équipe à affecter. L’affectation est une décision contrôlée, fondée au minimum sur les catégories concernées, les compétences valides de l’équipe et la disponibilité lorsqu’elle est connue.

## 5. Affectations

### RG30 — Condition préalable
Un dossier ne peut être affecté que si sa prise en charge a été acceptée, son emplacement est exploitable, un responsable habilité a validé la prise en charge, les catégories sont qualifiées et sa priorité a été définie selon la règle retenue.

### RG31 — Une affectation par catégorie
Chaque affectation concerne exactement un dossier, une équipe et un type de déchet qualifié dans ce dossier. Le décideur, la date, l'état, la compétence retenue et le motif pertinent sont conservés. Si une équipe prend en charge plusieurs catégories, chaque catégorie possède une affectation distincte.

### RG32 — Compatibilité de la catégorie et de la compétence
La paire `(idDossier, idTypeDechet)` de l'affectation doit exister dans `CONTENU_DOSSIER` et la catégorie doit être à l'état `INCLUSE`. L'équipe doit avoir une compétence correspondante valide à la date d'affectation ; l'identifiant de la compétence utilisée est conservé pour justifier la décision historique.

### RG32 bis — Retrait d'une catégorie qualifiée
Si une catégorie est déclarée hors périmètre après qualification, elle passe à l'état `RETIRE` au lieu d'être supprimée lorsqu'elle peut être référencée par des affectations ou des événements antérieurs. Le motif, l'acteur et la date sont conservés. Une catégorie ne peut être retirée tant qu'une affectation courante existe ; celle-ci doit d'abord être terminée, remplacée ou annulée avec historique.

### RG33 — Affectation courante par catégorie
Pour un couple dossier/catégorie donné, une seule affectation courante est autorisée. Les affectations courantes sont `ACTIVE` ou `A_VERIFIER`. Des catégories différentes du même dossier peuvent avoir des affectations courantes en parallèle, y compris vers la même équipe au moyen de lignes distinctes.

### RG34 — Réaffectation
Une réaffectation termine l'affectation courante de la catégorie et crée une nouvelle affectation dans une opération cohérente. L'ancienne équipe, le motif, l'acteur et les dates restent consultables. Les événements liés à cette décision partagent un identifiant de corrélation si plusieurs objets changent.

### RG35 — Intervention liée à une affectation
Chaque intervention appartient à une affectation unique. Une affectation peut ne produire aucune intervention ou en produire plusieurs visites.

### RG36 — Équipe exécutante
L’équipe exécutante est celle de l’affectation liée, sauf changement explicitement autorisé et tracé. Le compte rendu ne peut pas modifier silencieusement l’équipe de référence.

### RG37 — États d’intervention
L’intervention possède un état et un résultat contrôlés. Les états minimum, les transitions autorisées et les motifs d’exception doivent être définis avec l’organisme.

### RG38 — Compte rendu
Une intervention ne peut être déclarée terminée que si le compte rendu et le résultat requis sont renseignés. Le compte rendu décrit ce qui a effectivement été réalisé, sans présumer d’une résolution totale.

### RG39 — Résultats partiels ou impossibles
Les résultats tels que « partiellement traité », « dépôt introuvable », « accès impossible », « reporté » ou « intervention spécialisée nécessaire » ne sont pas assimilés à une réussite complète. Les valeurs exactes sont à confirmer.

### RG40 — Preuves visuelles
Les photos d’intervention sont facultatives ou conditionnelles selon la politique convenue. Si une photo est demandée, son contexte (avant, après, autre) et sa date doivent être conservés. Une photo seule ne garantit pas la résolution.

### RG41 — Vérification distincte par affectation et par catégorie
La fin déclarée par l'équipe et la vérification de résolution sont distinctes. Chaque vérification concerne une affectation, laquelle ne porte que sur une catégorie. La personne habilitée, la date, le résultat, les preuves utiles et le motif éventuel sont conservés. Les vérifications antérieures ne sont pas écrasées.

### RG42 — Clôture du dossier complet
Le dossier ne peut être déclaré entièrement résolu que lorsque chaque catégorie à traiter possède une affectation terminée après vérification positive. Une catégorie partiellement traitée ou non confirmée empêche la résolution complète, sauf clôture exceptionnelle explicitement autorisée et motivée. L'ajout d'une nouvelle catégorie après clôture exige une réouverture tracée.

### RG43 — Réouverture
Une réouverture autorisée depuis un dossier clôturé produit l’événement `DOSSIER_REOUVERT`, avec état précédent, auteur, date et motif, puis place le statut courant à `A_QUALIFIER`. `REOUVERT` n’est pas un état durable. L’état et les vérifications antérieures ne sont pas effacés. Si le traitement d’une catégorie déjà vérifiée positivement doit reprendre, une nouvelle affectation est créée ; l’affectation terminée n’est pas réactivée silencieusement.

## 7. Points citoyens — hors périmètre initial

Les points et récompenses ne sont pas inclus dans le modèle initial et ne conditionnent jamais la réception ou le traitement d’un signalement. Toute activation ultérieure nécessiterait un barème transparent, un registre de mouvements, des règles anti-abus et un mécanisme de correction ou de réclamation.

### RG44 — Points non requis
La soumission ou le traitement d’un signalement ne dépend d’aucune récompense. Les points citoyens ne font pas partie du prototype initial.

### RG45 — Conditions d’une éventuelle extension
Si une version future introduit des points, elle doit définir un barème public qui ne récompense pas simplement chaque signalement soumis et qui traite les doublons, rejets, corrections et réouvertures.

### RG46 — Traçabilité des récompenses futures
Toute extension de points devra conserver des mouvements distincts, corrigeables et attribuables, avec des règles anti-abus. Ces données ne sont pas prévues dans le MCD/MLD de la version 2.8.

## 8. Journal métier et historique

### RG47 — Événements significatifs
Toute création ou modification métier ayant un effet sur l’état, la responsabilité ou le résultat produit un événement métier approprié. Si un mécanisme de récompense est ajouté ultérieurement, ses mouvements devront également être tracés.

### RG48 — Contenu d’événement
Un événement conserve au minimum son type, l’objet principal visé, la date effective si elle est connue, la date d’enregistrement, l’origine et l’acteur humain lorsqu’il existe. Les valeurs avant/après et les motifs ne contiennent que les informations utiles.

### RG49 — Dates différentes
`dateEvenement` et `dateEnregistrement` sont distinctes. Une action reçue en différé doit pouvoir être reconnue comme telle sans antidater la date de réception.

### RG50 — Conservation historique
Le journal métier n’est pas modifié ou supprimé par les opérations ordinaires. Une correction crée une nouvelle trace référant à la décision ou à l’événement corrigé. Les durées et modalités d’archivage restent gouvernées par la politique de conservation.

### RG51 — Cohérence de l’opération
Le changement d’état et l’événement correspondant doivent être enregistrés de manière cohérente. Un échec de transition ne doit pas laisser une trace prétendant que la transition a réussi.

### RG52 — Répétition d’une opération
Une même opération reçue plusieurs fois ne doit pas créer plusieurs affectations ou événements métier indus. Une référence d’opération unique ou une garantie équivalente est nécessaire.

### RG53 — Cible valide
Chaque événement possède exactement une cible principale existante et de type cohérent. Pour les cibles simples, une seule référence typée est renseignée. Si la cible est une ligne `CONTENU_DOSSIER`, les identifiants du dossier et du type de déchet sont renseignés ensemble et forment une seule cible composée.

### RG54 — Attribution de l’acteur
L’acteur authentifié est déterminé par le contexte de confiance du système et non par une valeur libre fournie dans le formulaire. Un traitement automatique précise son origine.

### RG55 — Séparation des journaux
Les événements métier, les notifications, les journaux techniques et les journaux de sécurité ont des finalités distinctes, des droits d’accès distincts et des politiques de conservation adaptées.

## 9. Données personnelles et indicateurs

### RG56 — Minimisation
Chaque donnée personnelle, chaque photographie et chaque information de localisation doit avoir une finalité. Un champ sans besoin démontré n’est pas rendu obligatoire.

### RG57 — Accès et conservation
Les autorisations, durées de conservation, procédures de suppression ou d’anonymisation et réponses aux demandes des personnes doivent être définies après vérification du cadre applicable.

### RG58 — Définition des indicateurs
Chaque indicateur statistique doit préciser sa formule, la population couverte, la période, les événements de début et de fin, les exclusions et la source de donnée.

### RG59 — Qualité des statistiques
Un tableau de bord distingue les observations reçues, dossiers créés, interventions effectuées, résolutions vérifiées, réouvertures et cas sans suite. Ces mesures ne sont pas interchangeables.

## 10. Règle de maintenance documentaire

### RG60 — Cohérence interdocumentaire
Toute modification des statuts, cardinalités ou responsabilités est répercutée dans le dictionnaire, le MCD, le MLD, le cycle de vie, les cas d’utilisation, le journal d’événements et les tests. Une divergence entre documents est considérée comme une anomalie à corriger avant de présenter le modèle comme final.

### RG61 — Décision d'acceptation et rattachement effectif
`ACCEPTE_POUR_RATTACHEMENT` représente une décision métier positive avant la création d'un lien actif ; `RATTACHE` signifie qu'un `RATTACHEMENT_SIGNALEMENT` actif existe réellement. Ces états ne sont pas interchangeables. La création ou la correction d'un lien, l'état du signalement et l'événement correspondant doivent être cohérents dans une même opération logique. Le retrait d'un lien sans remplacement exige un motif et ramène le signalement à `ACCEPTE_POUR_RATTACHEMENT` ou `QUALIFIE` selon la décision enregistrée.
