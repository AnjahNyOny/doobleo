# 📖 User Stories — Doobleo

> Format : **En tant que** [rôle], **je veux** [action], **afin de** [bénéfice].
> Chaque story inclut ses **critères d'acceptation** (ce qui doit être vrai pour considérer la story "done").

---

## 👥 Rôles

| Rôle       | Description                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| **Admin**  | Gestionnaire du contenu. Crée et publie les scènes via le back-office.      |
| **Host**   | Joueur qui crée le salon. Choisit la scène et lance la partie.              |
| **Joueur** | Rejoins un salon existant via un code. Choisit un personnage et enregistre. |
| **Invité** | Joue sans compte. Accès limité (pas d'historique, pas de profil).           |

> Un **Host** est aussi un **Joueur** (il participe à la session qu'il a créée).

---

## 🔐 Authentification & Profil

### US-01 — Inscription avec email

**En tant que** visiteur,
**je veux** créer un compte avec mon email et un mot de passe,
**afin de** sauvegarder mon profil et accéder à l'historique de mes sessions.

**Critères d'acceptation :**

- [ ] Le formulaire valide l'email (format) et le mot de passe (min. 8 caractères)
- [ ] Un email de confirmation est envoyé (ou l'accès est immédiat — à décider)
- [ ] Si l'email est déjà utilisé, un message d'erreur clair est affiché
- [ ] Après inscription, l'utilisateur est automatiquement connecté et redirigé vers le Lobby

---

### US-02 — Connexion

**En tant que** utilisateur inscrit,
**je veux** me connecter avec mon email et mot de passe,
**afin de** retrouver mon profil et mes préférences.

**Critères d'acceptation :**

- [ ] Si les identifiants sont incorrects, un message d'erreur générique est affiché (pas "email introuvable" pour éviter l'énumération)
- [ ] La session est maintenue via un cookie httpOnly (pas de JWT exposé côté client)
- [ ] Un bouton "Rester connecté" prolonge la session

---

### US-03 — Jouer en tant qu'invité

**En tant que** visiteur sans compte,
**je veux** entrer un pseudo temporaire et jouer directement,
**afin de** tester l'app sans m'inscrire.

**Critères d'acceptation :**

- [ ] Le pseudo est requis (2-20 caractères, sans caractères spéciaux)
- [ ] La session invité est stockée localement (sessionStorage)
- [ ] L'invité voit une bannière lui proposant de créer un compte pour sauvegarder son profil
- [ ] À la fermeture du navigateur, la session invité est perdue (comportement attendu)
- [ ] Un invité ne peut pas accéder au back-office admin

---

### US-04 — Déconnexion

**En tant que** utilisateur connecté,
**je veux** me déconnecter,
**afin de** sécuriser mon compte sur un appareil partagé.

**Critères d'acceptation :**

- [ ] Le cookie de session est invalidé côté serveur
- [ ] L'utilisateur est redirigé vers la page d'accueil
- [ ] Si l'utilisateur est dans un salon actif, un avertissement lui demande de confirmer

---

### US-05 — Modifier son profil

**En tant que** utilisateur inscrit,
**je veux** modifier mon pseudo et mon avatar,
**afin de** personnaliser mon identité dans les salons.

**Critères d'acceptation :**

- [ ] Le pseudo doit être unique (validation côté serveur)
- [ ] L'avatar peut être une image uploadée (max 2 Mo, formats JPG/PNG/WebP) ou un avatar généré automatiquement
- [ ] Les modifications sont reflétées immédiatement dans les salons actifs

---

## 🎛️ Administration (CMS)

### US-06 — Accéder au back-office

**En tant que** admin,
**je veux** accéder à un espace d'administration protégé,
**afin de** gérer le contenu sans exposer les outils aux joueurs.

**Critères d'acceptation :**

- [ ] L'URL `/admin` redirige vers une page de login si non connecté en tant qu'admin
- [ ] Un utilisateur avec le rôle `player` voit une page 403 s'il tente d'accéder à `/admin`
- [ ] Le back-office affiche un dashboard avec les métriques clés (scènes publiées, salons actifs du jour)

---

### US-07 — Créer une scène

**En tant que** admin,
**je veux** créer une nouvelle scène en uploadant une vidéo et une piste audio M&E,
**afin de** mettre du nouveau contenu à disposition des joueurs.

**Critères d'acceptation :**

- [ ] Les champs obligatoires sont : titre, vidéo MP4 (muette), piste audio M&E
- [ ] Les champs optionnels sont : description, image de couverture
- [ ] La progression de l'upload est affichée (barre de progression en %)
- [ ] Si l'upload échoue, un message d'erreur est affiché avec la possibilité de réessayer
- [ ] La scène est créée avec le statut `brouillon` (non visible par les joueurs)
- [ ] Les formats acceptés : vidéo MP4 (max 500 Mo), audio MP3/WAV (max 100 Mo)

---

### US-08 — Ajouter des personnages à une scène

**En tant que** admin,
**je veux** ajouter les personnages d'une scène avec leur nom et une couleur,
**afin que** les joueurs puissent se les attribuer dans le salon.

**Critères d'acceptation :**

- [ ] Chaque personnage a : nom, couleur (color picker), description optionnelle
- [ ] Il faut au minimum 1 personnage pour pouvoir publier une scène
- [ ] Les personnages peuvent être réordonnés (drag & drop)
- [ ] Un personnage peut être supprimé s'il n'a pas encore de répliques associées

---

### US-09 — Créer les répliques via l'éditeur de timecodes

**En tant que** admin,
**je veux** marquer les timecodes de début et fin de chaque réplique en regardant la vidéo,
**afin de** générer le JSON du prompteur synchronisé.

**Critères d'acceptation :**

- [ ] L'éditeur affiche la vidéo et un tableau de répliques à côté
- [ ] En cliquant "Marquer début" / "Marquer fin", le timecode `currentTime` est capturé automatiquement
- [ ] Chaque réplique est associée à un personnage (liste déroulante)
- [ ] Le prompteur de prévisualisation défile en temps réel en lisant la vidéo
- [ ] L'ordre des répliques peut être réajusté manuellement
- [ ] Le JSON peut être exporté et réimporté (pour édition externe)
- [ ] Si deux répliques se chevauchent en timecodes, un avertissement est affiché

---

### US-10 — Publier / Dépublier une scène

**En tant que** admin,
**je veux** contrôler la visibilité d'une scène,
**afin de** ne montrer que les scènes prêtes aux joueurs.

**Critères d'acceptation :**

- [ ] Une scène ne peut pas être publiée si elle n'a pas de personnages ni de répliques
- [ ] Changer le statut de `publié` à `brouillon` retire immédiatement la scène de la liste joueur
- [ ] Si une scène dépubliée est actuellement en cours d'utilisation dans un salon, un avertissement est affiché (le salon en cours n'est pas interrompu)

---

### US-11 — Supprimer une scène

**En tant que** admin,
**je veux** supprimer une scène obsolète,
**afin de** garder la bibliothèque de contenu propre.

**Critères d'acceptation :**

- [ ] Une confirmation est demandée avant suppression
- [ ] Les fichiers médias associés (vidéo, audio M&E) sont supprimés du stockage R2/S3
- [ ] Si la scène est utilisée dans un salon actif, la suppression est bloquée avec un message explicatif

---

## 🚪 Gestion du Salon (Lobby & Salle d'attente)

### US-12 — Créer un salon

**En tant que** Host (joueur connecté ou invité),
**je veux** créer un salon et obtenir un code à partager,
**afin d'** inviter mes amis à joindre la partie.

**Critères d'acceptation :**

- [ ] Un code unique à 6 caractères (lettres majuscules + chiffres) est généré
- [ ] Le code est affiché en grand avec un bouton "Copier"
- [ ] Le salon a un statut `en_attente` à sa création
- [ ] Le Host est automatiquement le premier joueur du salon
- [ ] Un salon sans activité depuis 30 minutes est automatiquement fermé

---

### US-13 — Rejoindre un salon

**En tant que** joueur (connecté ou invité),
**je veux** entrer un code à 6 caractères pour rejoindre un salon,
**afin de** participer à la session de doublage.

**Critères d'acceptation :**

- [ ] Si le code est invalide ou expiré, un message d'erreur clair est affiché
- [ ] Si le salon est en cours de partie (statut `en_jeu`), l'accès est refusé
- [ ] Si le salon est plein **(6 joueurs max)**, l'accès est refusé avec un message clair
- [ ] À l'entrée, le joueur apparaît dans la liste des joueurs connectés pour tous les autres (temps réel)

---

### US-14 — Choisir la scène (Host)

**En tant que** Host,
**je veux** parcourir et sélectionner une scène depuis la bibliothèque,
**afin de** définir ce que le groupe va doubler.

**Critères d'acceptation :**

- [ ] Seules les scènes avec le statut `publié` sont affichées
- [ ] Chaque scène montre : titre, image de couverture, durée, nombre de personnages
- [ ] Un aperçu de la vidéo est possible (hover ou clic)
- [ ] Seul le Host voit le bouton de sélection. Les autres joueurs voient la scène choisie en temps réel.

---

### US-15 — Choisir un personnage

**En tant que** joueur,
**je veux** sélectionner un personnage disponible dans la scène,
**afin de** m'attribuer un rôle pour l'enregistrement.

**Critères d'acceptation :**

- [ ] Les personnages déjà pris sont affichés comme indisponibles (verrouillés avec le nom du joueur)
- [ ] Deux joueurs ne peuvent pas prendre le même personnage (géré côté serveur)
- [ ] Un joueur peut changer de personnage tant que la partie n'a pas commencé
- [ ] En changeant de personnage, l'ancien est libéré pour les autres (en temps réel)

---

### US-16 — Signaler qu'on est prêt

**En tant que** joueur,
**je veux** cliquer "Je suis prêt" une fois mon personnage choisi,
**afin d'** indiquer au Host que je suis prêt à commencer.

**Critères d'acceptation :**

- [ ] Le statut "Prêt" de chaque joueur est visible par tous en temps réel (indicateur vert/gris)
- [ ] Le bouton "Je suis prêt" est désactivé si aucun personnage n'est sélectionné
- [ ] Un joueur peut annuler son statut "Prêt" avant le lancement

---

### US-17 — Lancer la partie (Host)

**En tant que** Host,
**je veux** lancer la session une fois tout le monde prêt,
**afin de** démarrer l'enregistrement synchronisé.

**Critères d'acceptation :**

- [ ] Le bouton "Lancer" est **toujours actif** pour le host, même seul, même si des joueurs n'ont pas de personnage ou ne sont pas prêts
- [ ] Si des joueurs ne sont pas prêts, une confirmation est demandée : _"2 joueurs ne sont pas prêts. Lancer quand même ?"_
- [ ] Un compte à rebours **(3-2-1)** est affiché chez **tous** les clients avant le début de la lecture
- [ ] Le timestamp de départ est envoyé via le serveur pour garantir la synchronisation

---

## 🎙️ Studio d'Enregistrement

### US-18 — Lire la vidéo et le prompteur synchronisés

**En tant que** joueur dans le studio,
**je veux** voir la vidéo muette et mon prompteur de répliques défiler en même temps,
**afin de** savoir quand parler.

**Critères d'acceptation :**

- [ ] La vidéo muette et la piste M&E sont lus simultanément
- [ ] Le prompteur défile automatiquement en fonction des timecodes JSON
- [ ] La réplique "active" (en cours) est mise en surbrillance avec la couleur du personnage
- [ ] Les répliques des autres personnages sont affichées mais grisées (pour contexte)
- [ ] La synchronisation est maintenue avec une tolérance de ±100ms

---

### US-19 — Enregistrer sa voix

**En tant que** joueur,
**je veux** que mon micro enregistre automatiquement mes répliques pendant la lecture,
**afin de** produire ma piste audio de doublage.

**Critères d'acceptation :**

- [ ] La permission micro est demandée avant le lancement (pas pendant)
- [ ] Si la permission est refusée, le joueur voit un écran d'erreur avec des instructions pour l'activer
- [ ] Un VU-mètre visuel montre que le micro capte bien le son
- [ ] L'enregistrement démarre et s'arrête automatiquement avec la vidéo
- [ ] L'audio est enregistré en continu (pas réplique par réplique) pour garder le naturel

---

### US-20 — Gérer une déconnexion pendant l'enregistrement

**En tant que** joueur,
**je veux** être notifié si un autre joueur se déconnecte pendant la partie,
**afin de** savoir si la session est compromise.

**Critères d'acceptation :**

- [ ] Si un joueur se déconnecte, les autres voient une notification immédiate : _"[Pseudo] s'est déconnecté. Reconnexion en cours..."_
- [ ] Une fenêtre d'attente de **30 secondes** est ouverte pour permettre la reconnexion
- [ ] **Si le joueur se reconnecte dans les 30 sec** : la session continue sans interruption, il retrouve son enregistrement
- [ ] **Si le joueur ne revient pas après 30 sec** : le host voit une modale avec deux choix :
  - **Continuer** → le personnage absent sera muet dans le rendu final
  - **Annuler la session** → tous les clients sont redirigés vers la salle d'attente
- [ ] Si le **Host** se déconnecte, le joueur suivant dans la liste devient automatiquement Host
- [ ] Le nouveau host reçoit la même modale de décision si l'ancien host ne revient pas

---

## 🎬 Rendu Final & Téléchargement

### US-21 — Voir le résultat mixé

**En tant que** joueur ayant terminé la session,
**je veux** regarder la vidéo finale avec toutes les voix mixées,
**afin de** profiter du résultat de notre doublage collectif.

**Critères d'acceptation :**

- [ ] Après la fin de la vidéo, tous les clients sont redirigés vers l'écran de rendu
- [ ] Un indicateur de chargement est affiché pendant le traitement FFmpeg
- [ ] Le délai de traitement est estimé et affiché (ex : "Mixage en cours... ~15 sec")
- [ ] Si le mixage échoue, un message d'erreur est affiché avec un bouton "Réessayer"
- [ ] La vidéo finale MP4 est lisible directement dans le navigateur

---

### US-22 — Télécharger la vidéo finale

**En tant que** joueur,
**je veux** télécharger le MP4 final sur mon appareil,
**afin de** le garder ou le partager.

**Critères d'acceptation :**

- [ ] Un bouton "Télécharger" avec l'icône de téléchargement est affiché en évidence
- [ ] Le téléchargement utilise une URL signée temporaire (valide ~30 min)
- [ ] Une bannière avertit : _"Ce fichier sera supprimé dans X minutes. Téléchargez-le maintenant."_ avec un compte à rebours
- [ ] Après expiration, le bouton est désactivé et le fichier est inaccessible
- [ ] Le nom du fichier téléchargé est formaté : `doobleo-[titre-scene]-[date].mp4`

---

### US-23 — Rejouer une session

**En tant que** Host sur l'écran de rendu,
**je veux** pouvoir relancer une nouvelle session avec le même groupe,
**afin de** doubler une autre scène sans ressaisir le code.

**Critères d'acceptation :**

- [ ] Un bouton "Rejouer" crée un nouveau salon avec les mêmes joueurs (si tous sont encore connectés)
- [ ] Les joueurs peuvent changer de personnage dans la nouvelle salle d'attente
- [ ] Si un joueur a quitté, il n'est pas inclus dans le nouveau salon

---

## ⚠️ Gestion des Erreurs (Transversale)

### US-24 — Micro refusé par le navigateur

**En tant que** joueur,
**je veux** voir des instructions claires si je refuse l'accès au micro,
**afin de** comprendre comment le réactiver.

**Critères d'acceptation :**

- [ ] Un écran dédié explique comment débloquer le micro dans Chrome, Firefox et Safari
- [ ] Le Host est notifié qu'un joueur n'a pas accordé l'accès micro
- [ ] Le joueur peut cliquer "J'ai activé le micro" pour réessayer sans recharger la page

---

### US-25 — Salon expiré ou inexistant

**En tant que** visiteur qui entre un code,
**je veux** voir un message clair si le salon n'existe pas,
**afin de** ne pas rester bloqué sur un écran vide.

**Critères d'acceptation :**

- [ ] Si le code n'existe pas → message : _"Ce salon n'existe pas ou a expiré."_
- [ ] Si le salon est en cours de partie → message : _"Cette session a déjà commencé."_
- [ ] Si le salon est plein → message : _"Ce salon est complet (X/X joueurs)."_
- [ ] Dans tous les cas, un bouton "Retour à l'accueil" est affiché

---

_Dernière mise à jour : Septembre 2026_
