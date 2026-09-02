# 📝 Plan de Conception et Développement : Doobleo (Web Version)

> Inspiré de "The Choicer Voicer" — Application web de doublage collaboratif en temps réel.

---

## 🎯 Vision du Projet

Créer une application web de doublage collaboratif (_blind dubbing_) robuste, performante et sans installation requise. Les joueurs rejoignent un salon en ligne, choisissent un personnage, et enregistrent leurs répliques en suivant un prompteur synchronisé. Le résultat est un mixage audio-vidéo en temps réel, partageable instantanément.

**Principes directeurs :**

- ✅ Zero-install (100% navigateur)
- ✅ Temps réel fiable (WebSockets)
- ✅ Expérience utilisateur fluide et amusante
- ✅ Contenu géré par un CMS sur-mesure (pas de hardcode)
- ✅ Déployable et maintenable en production

---

## 🛠️ Stack Technique Validée

| Couche                   | Technologie              | Justification                                       |
| ------------------------ | ------------------------ | --------------------------------------------------- |
| **Frontend**             | Nuxt 4, Vue.js 3, Pinia  | SSR/SPA hybride, réactivité native                  |
| **UI / Styles**          | Tailwind CSS v4, GSAP    | Rapidité de dev + animations premium                |
| **Temps Réel**           | Socket.io (WebSockets)   | Salons, sync playback, signaux                      |
| **API REST**             | Nitro (intégré Nuxt)     | Endpoints serveur sans Express séparé               |
| **Base de données**      | PostgreSQL + Drizzle ORM | Typage fort, migrations simples                     |
| **Stockage médias**      | Cloudflare R2 (ou S3)    | Vidéos/audio pas en local → scalable                |
| **Auth**                 | nuxt-auth-utils + JWT    | Sessions légères, social login optionnel            |
| **Mixage vidéo**         | FFmpeg (serveur)         | Génère le MP4 final (vidéo + voix + M&E)            |
| **Job Queue**            | BullMQ + Redis           | File d'attente pour le traitement FFmpeg asynchrone |
| **Hébergement Backend**  | Railway ou Render        | Node.js + PostgreSQL managé, WebSockets OK          |
| **Hébergement Frontend** | Vercel (Nuxt SSR natif)  | Meilleur support Nuxt vs Netlify                    |
| **CI/CD**                | GitHub Actions           | Tests + déploiement automatisé                      |
| **Env / Secrets**        | dotenv + .env.example    | Aucun secret hardcodé                               |

> ⚠️ **Changements vs version initiale :**
>
> - `Express` remplacé par `Nitro` (déjà inclus dans Nuxt 4, évite la duplication)
> - `Netlify` → `Vercel` (meilleur support SSR Nuxt + WebSockets)
> - Ajout de `Drizzle ORM` pour les migrations typées
> - Ajout de `Cloudflare R2` pour le stockage des médias (les vidéos/audio ne peuvent pas vivre sur le serveur)

---

## 🗄️ Modèle de Données (Entités)

```
users         → id, username, avatar_url, created_at
rooms         → id, code (6 chars), scene_id, status (waiting/playing/done), host_user_id, created_at
room_players  → id, room_id, user_id, character_id, joined_at
scenes        → id, title, description, thumbnail_url, video_url, audio_me_url, duration_ms, is_published
characters    → id, scene_id, name, color, description
lines         → id, character_id, scene_id, text, start_ms, end_ms, order
recordings    → id, room_id, user_id, character_id, audio_url, duration_ms, created_at
```

**Décisions confirmées :**

- [x] ~~Enregistrements permanents ?~~ → **Supprimés après la session.** Avant suppression, les users peuvent télécharger leur vidéo mixée.
- [x] ~~Compte obligatoire ?~~ → **Hybride** : compte recommandé, mais jeu possible en tant qu'invité (pseudo temporaire).
- [x] ~~Mixage final~~ → **Option B confirmée : FFmpeg côté serveur → MP4 qualité pro.** Stack ajoutée : `ffmpeg` + `BullMQ` + `Redis`.

---

## 🗓️ Roadmap de Développement

---

### ✅ Phase 0 : Fondations du Projet _(Avant de toucher au code)_

> **Objectif :** Avoir une base solide et des décisions fermes pour éviter les refactorisations coûteuses.

- [x] Définition du MVP et des parcours utilisateurs
- [x] Validation de la stack technique
- [x] Définition des entités de la base de données
- [x] **Rédiger les User Stories** : 25 stories couvrant tous les rôles → voir [USER_STORIES.md](./USER_STORIES.md)
- [ ] **Wireframes / Maquettes UI** : Lobby, Salle d'attente, Studio d'enregistrement, Écran de rendu final, Interface Admin CMS _(Figma ou Excalidraw)_
- [x] **Définir les règles métier** :
  - **6 joueurs max** par salon
  - **Déconnexion pendant l'enregistrement** : attente de ~30 sec, puis le host choisit de continuer (le perso absent est muet dans le rendu) ou d'annuler la session
  - **Lancement** : le host peut lancer à tout moment, même seul, même si des joueurs ne sont pas prêts (confirmation requise si joueurs non prêts)
  - **Enregistrements** : supprimés après expiration du lien de téléchargement (~30 min)
- [x] **Structure du repo** : **Monorepo** (front + back dans un seul repo) — partage de types TypeScript facilité
- [ ] **Créer le fichier `.env.example`** avec toutes les variables requises (DB, S3, JWT secret, etc.)
- [ ] **Rédiger le README.md** avec instructions d'installation locale

---

### 🚧 Phase 1 : Infrastructure et CI/CD

> **Objectif :** Avoir un pipeline de déploiement fonctionnel dès le jour 1, même avec une app vide.

- [ ] Initialiser le projet Nuxt 4 (`nuxi init`)
- [ ] Configurer ESLint + Prettier + Husky (pre-commit hooks)
- [ ] Configurer TypeScript strict mode
- [ ] Mettre en place la base PostgreSQL (locale via Docker Compose)
- [ ] Initialiser Drizzle ORM + écrire le schéma initial + première migration
- [ ] Configurer le bucket de stockage (Cloudflare R2 ou AWS S3)
- [ ] Mettre en place GitHub Actions :
  - Pipeline de lint et typecheck (sur chaque PR)
  - Pipeline de déploiement auto (merge sur `main` → deploy)
- [ ] Déployer l'app vide sur Vercel + Railway pour valider la pipeline end-to-end
- [ ] Configurer le domaine personnalisé (si applicable)

---

### 🔐 Phase 2 : Authentification et Gestion des Utilisateurs

> **Objectif :** Avoir un système d'auth solide avant de construire quoi que ce soit par-dessus.

- [x] Implémenter l'authentification avec `nuxt-auth-utils` :
  - Inscription / Connexion (email + password)
  - Sessions JWT sécurisées (httpOnly cookies, 7 jours)
  - Optionnel : OAuth (Google, Discord)
- [x] Middleware de protection des routes (pages admin, API privées)
- [x] Gestion des rôles : `player` vs `admin`
- [x] Page profil utilisateur (avatar, username)
- [x] Gestion de l'anonymat : permettre de jouer sans compte (pseudo temporaire + sessionStorage)

---

### 🎛️ Phase 3 : Le CMS Sur-mesure (Interface Administrateur)

> **Objectif :** Avoir un outil fonctionnel pour injecter de vraies données avant de coder le jeu. Ne pas hardcoder une seule scène.

- [x] Layout back-office protégé par le rôle `admin`
- [x] **Module Upload Médias** :
  - Upload de vidéos MP4 (muettes) vers R2/S3 avec barre de progression
  - Upload de pistes audio M&E (musique et effets sans dialogue) vers R2/S3
  - Validation des formats et taille max côté client ET serveur
- [x] **CRUD Scènes** : Créer, lister, modifier, supprimer, publier/dépublier une scène
- [x] **CRUD Personnages** : Ajouter les personnages associés à une scène avec couleur et description
- [x] **Éditeur de répliques (Subtitle Editor)** :
  - Interface de lecture vidéo intégrée
  - Bouton "Marquer début" / "Marquer fin" pour capturer les timecodes (`currentTime`)
  - Associer la réplique à un personnage
  - Prévisualisation du prompteur en temps réel
  - Export/Import du JSON de répliques
- [x] Dashboard admin : nombre de scènes, salons actifs, enregistrements récents
- [ ] **Tester avec au moins 2 vraies scènes** avant de passer à la phase suivante

---

### 🎙️ Phase 4 : Preuve de Concept (PoC) — Cœur Multimédia

> **Objectif :** Valider la faisabilité technique du traitement audio dans le navigateur. C'est le cœur du jeu. Ne pas continuer si ce PoC échoue.

- [x] **Capture micro** :
  - Demande de permission micro avec gestion des refus
  - Implémentation via `MediaRecorder API`
  - Détection des niveaux audio (VU-mètre visuel)
- [x] **Gestion des blobs audio** :
  - Sauvegarde temporaire (Blob WebM/WAV en mémoire)
  - Upload vers R2/S3 après session (via `/api/recordings/upload`)
- [x] **Synchronisation du playback** :
  - Lecture simultanée : vidéo muette + piste M&E + enregistrement local
  - Utilisation de `AudioContext` pour la synchronisation précise
  - Gestion des latences et décalages (`AudioContext.currentTime`)
- [x] **Page de test unifié (`/poc`)** : regroupant toutes ces fonctionnalités.
- [x] ~~Décision architecturale~~ → **Option B confirmée : FFmpeg côté serveur**
- [ ] **Téléchargement** : Générer un lien signé (URL temporaire S3/R2, valide ~30 min) après génération du MP4, puis suppression automatique

---

### 🔌 Phase 5 : Backend Temps Réel (WebSockets)

> **Objectif :** Gérer toute la logique multijoueur de façon robuste.

- [x] Initialiser Socket.io dans le serveur Nitro (ou serveur séparé si nécessaire)
- [x] **Événements de salon** :
  - `create_room` → générer un code unique à 6 caractères
  - `join_room` → rejoindre, valider que la scène existe et que le salon n'est pas plein
  - `user_joined` / `user_left` → broadcast aux autres joueurs
  - `disconnect` → gérer le cas host déconnecté (transfert de host ?)
- [x] **Sélection des personnages** :
  - `select_character` → verrouiller un personnage pour un joueur
  - `character_locked` / `character_released` → broadcast en temps réel
  - Empêcher deux joueurs de prendre le même personnage
- [x] **Orchestration de la session** :
  - `host_start_game` → vérifier que tous les joueurs sont prêts
  - `sync_playback` → envoyer un timestamp de départ précis à tous les clients
  - `playback_started` → confirmation de chaque client
- [x] **Échange audio** :
  - `audio_ready` → notifier les autres que l'enregistrement est uploadé sur R2/S3
  - `session_complete` → tous les audios reçus, déclencher le job de mixage FFmpeg
- [x] **Pipeline de mixage FFmpeg (BullMQ)** :
  - Créer un `MixingJob` : récupérer vidéo muette + piste M&E + tous les blobs audio depuis R2
  - Commande FFmpeg : mixer les pistes audio ensemble sur la vidéo → export MP4
  - Uploader le MP4 final sur R2 → générer une URL signée (~30 min)
  - Événement `mix_ready` → envoyer l'URL aux clients via Socket.io
  - Nettoyage : supprimer tous les fichiers intermédiaires (blobs audio) après mix
  - Planifier la suppression du MP4 final après expiration de l'URL
- [x] **Gestion des erreurs temps réel** :
  - Timeout si un joueur ne répond pas
  - Reconnexion automatique (Socket.io le gère, mais à configurer)
  - Gestion de l'échec FFmpeg : notifier les clients + proposer un retry
- [ ] Tests de charge : simuler 5-10 clients simultanés en local

---

### 🖥️ Phase 6 : Frontend — L'Application Joueur

> **Objectif :** Assembler l'interface publique avec Nuxt et Pinia.

- [x] **Design System** : Définir les composants de base (Button, Card, Badge, Modal, Toast)
- [x] **Lobby (`/`)** :
  - Créer un salon (host) → génère un code à 6 caractères
  - Rejoindre un salon (player) → saisir le code
  - **Mode avec compte** : afficher l'avatar et le username persistant
  - **Mode invité** : saisir un pseudo temporaire (stocké en session locale, sans inscription)
- [x] **Salle d'attente (`/room/[code]`)** :
  - Liste des joueurs connectés en temps réel (via Socket.io)
  - Sélection de la scène (host uniquement)
  - Choix du personnage avec visualisation des personnages pris/libres
  - Bouton "Je suis prêt" par joueur
  - Bouton "Lancer" pour le host (désactivé si tous ne sont pas prêts)
- [x] **Studio d'enregistrement (`/room/[code]/studio`)** :
  - Lecteur vidéo muette en plein écran
  - Prompteur défilant synchronisé avec les timecodes JSON
  - Mise en surbrillance de la réplique active
  - Indicateur d'enregistrement (micro actif, VU-mètre)
  - Countdown visuel avant le lancement
- [x] **Écran de rendu final (`/room/[code]/playback`)** :
  - Lecteur vidéo avec mixage audio en temps réel
  - Indicateur de chargement pendant le traitement FFmpeg (Option B) ou l'assemblage navigateur (Option A)
  - **Bouton de téléchargement** : URL signée temporaire vers le MP4 final (valide ~30 min)
  - **Bannière d'avertissement** : "Ce fichier sera supprimé dans X minutes. Téléchargez-le maintenant."
  - Suppression automatique des fichiers côté serveur après expiration
- [x] **Gestion des états d'erreur** :
  - Salon inexistant ou expiré
  - Micro refusé par l'utilisateur
  - Déconnexion en cours de partie

---

### 🧪 Phase 7 : Tests, Qualité et Sécurité

> **Objectif :** Zéro crash en production. Tester avant de déployer.

- [ ] **Tests unitaires** : Fonctions utilitaires (calcul timecodes, génération de codes, validation)
- [ ] **Tests d'intégration** : API REST (Nitro endpoints) avec Vitest
- [ ] **Tests E2E** : Playwright — parcours complet de création de salon à playback final
- [ ] **Tests de charge** : Simuler 20+ connexions simultanées (outil : k6 ou Artillery)
- [ ] **Audit de sécurité** :
  - Validation des inputs (Zod) sur toutes les routes serveur
  - Protection CSRF
  - Rate limiting sur les endpoints publics
  - Variables d'environnement jamais exposées côté client
- [ ] **Accessibilité** : Audit WCAG basique (contraste, labels ARIA sur les boutons micro)
- [ ] **Performance** :
  - Lighthouse audit (Score > 85)
  - Optimisation des assets médias (lazy loading, preload vidéo)

---

### 🚀 Phase 8 : Déploiement et Mise en Production

> **Objectif :** App en ligne, stable et monitorée.

- [ ] **Variables d'environnement** : Configurer tous les secrets sur Vercel et Railway (jamais dans le repo)
- [ ] **Base de données** : Provisionner PostgreSQL managé sur Railway + run migrations
- [ ] **Stockage** : Configurer le bucket R2/S3 en production avec CORS pour le domaine de l'app
- [ ] **Backend** : Déployer le serveur Node.js (Nitro/Socket.io) sur Railway
  - Configurer NGINX ou Railway proxy pour maintenir les WebSockets longue durée
- [ ] **Frontend** : Déployer sur Vercel
  - Configurer les variables d'env de production
  - Activer le cache des assets statiques
- [ ] **Monitoring et alertes** :
  - Intégrer Sentry (erreurs frontend + backend)
  - Logs serveur centralisés (Railway logs ou Logtail)
  - Uptime monitoring (UptimeRobot — gratuit)
- [ ] **Tests finaux en conditions réelles** :
  - Test à distance avec 2+ personnes sur différents réseaux
  - Test sur mobile (iOS Safari + Android Chrome)
  - Test avec une mauvaise connexion (throttling réseau)
- [ ] **Checklist pré-lancement** :
  - [ ] HTTPS actif sur tous les endpoints
  - [ ] Backups automatiques PostgreSQL configurés
  - [ ] Page d'erreur 404 et 500 personnalisées
  - [ ] Politique de confidentialité si données utilisateurs stockées

---

## 📊 Résumé des Phases

| Phase | Nom                    | Durée Estimée | Priorité    |
| ----- | ---------------------- | ------------- | ----------- |
| 0     | Fondations & Décisions | 1-2 semaines  | 🔴 Critique |
| 1     | Infrastructure & CI/CD | 3-5 jours     | 🔴 Critique |
| 2     | Authentification       | 1 semaine     | 🟠 Haute    |
| 3     | CMS Admin              | 2-3 semaines  | 🔴 Critique |
| 4     | PoC Multimédia         | 1-2 semaines  | 🔴 Critique |
| 5     | Backend WebSockets     | 2 semaines    | 🔴 Critique |
| 6     | Frontend Jeu           | 3-4 semaines  | 🟠 Haute    |
| 7     | Tests & Sécurité       | 1 semaine     | 🟠 Haute    |
| 8     | Déploiement            | 3-5 jours     | 🟠 Haute    |

**Durée totale estimée (solo) : ~12-16 semaines**

---

## ⚠️ Risques et Points de Vigilance

| Risque                                                        | Impact      | Mitigation                                                     |
| ------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| Safari iOS bloque `AudioContext` sans interaction utilisateur | 🔴 Critique | Déclencher l'AudioContext sur un tap utilisateur explicite     |
| Latence WebSockets variable selon le réseau                   | 🟠 Moyen    | Utiliser un timestamp serveur + client-side clock sync         |
| Upload audio volumineux sur mauvaise connexion                | 🟠 Moyen    | Upload par chunks, retry automatique                           |
| Déconnexion du host en pleine partie                          | 🟠 Moyen    | Définir un mécanisme de transfert de host                      |
| Coût du stockage médias (vidéos)                              | 🟡 Bas      | Limiter la taille max des vidéos, purger les vieilles sessions |
| Synchronisation parfaite entre clients                        | 🔴 Critique | PoC obligatoire avant de coder le reste                        |

---

_Dernière mise à jour : Septembre 2026_
