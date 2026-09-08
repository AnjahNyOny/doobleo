<div align="center">
  <img src="https://raw.githubusercontent.com/AnjahNyOny/doobleo/main/public/logo.png" alt="Doobleo Logo" width="120" />

# 🎙️ Doobleo

**Application web de doublage collaboratif en temps réel.**

Redoublez vos scènes de films préférées entre amis, enregistrez vos voix en direct, et exportez la vidéo finale mixée instantanément.

[![Nuxt 3](https://img.shields.io/badge/Nuxt_3-00DC82?style=for-the-badge&logo=nuxt.js&logoColor=white)](https://nuxt.com/)
[![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)](https://vuejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
[![OpenAI Whisper](https://img.shields.io/badge/Whisper-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/research/whisper)
</div>

---

## ✨ Aperçu du projet

**Doobleo** est une plateforme ludique inspirée de _The Choicer Voicer_. Elle permet à un groupe d'amis de se réunir dans un salon virtuel, de choisir une scène de film, de s'attribuer les personnages, et de doubler la scène ensemble.

Le système inclut un prompteur synchronisé avec la vidéo, un système d'enregistrement audio en temps réel directement dans le navigateur, et un pipeline complet d'IA et de mixage vidéo côté serveur pour générer un résultat final téléchargeable.

### 🚀 Fonctionnalités Clés

- **🎮 Jeu Multijoueur en temps réel** : Salons privés (jusqu'à 6 joueurs) gérés via WebSockets (`Socket.io`).
- **🎤 Zéro Installation** : Enregistrement micro directement via la _Web Audio API_ du navigateur.
- **🎬 Mixage Vidéo Automatique** : Utilisation de `FFmpeg` et `BullMQ` pour fusionner les pistes vocales des joueurs avec la vidéo originale.
- **🤖 IA Intégrée (Whisper & Demucs)** : Script Python maison (`yt-dlp` + `openai-whisper`) pour générer les sous-titres, et intégration de `Replicate` pour la séparation vocale (karaoké) automatique.
- **🎛️ CMS Sur-mesure** : Panneau d'administration sécurisé pour gérer la bibliothèque de scènes, uploader des médias sur le Cloud, et corriger les répliques.
- **👤 Profils & Invités** : Connexion classique, ou mode "Guest" immédiat pour rejoindre une partie sans friction.

---

## 📸 Captures d'écran

_(Ajoutez ici les captures d'écran de l'application)_

|                                Le Lobby (Accueil)                                |                                Le Studio d'Enregistrement                                |
| :------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------: |
| <img src="https://via.placeholder.com/600x350?text=Lobby+Doobleo" width="400" /> | <img src="https://via.placeholder.com/600x350?text=Studio+Enregistrement" width="400" /> |

|                            La Bibliothèque de Scènes                            |                                   Le Panel Admin                                   |
| :-----------------------------------------------------------------------------: | :--------------------------------------------------------------------------------: |
| <img src="https://via.placeholder.com/600x350?text=Bibliotheque" width="400" /> | <img src="https://via.placeholder.com/600x350?text=Admin+Dashboard" width="400" /> |

---

## 🛠️ Technologies Utilisées

L'architecture de Doobleo repose sur une stack moderne, pensée pour le temps réel et le traitement de médias lourds :

### Frontend

- **Framework** : [Nuxt 3](https://nuxt.com/) / Vue 3
- **State Management** : Pinia
- **Styling** : Vanilla CSS & CSS Variables (Mode Sombre/Clair, Glassmorphism, UI Premium)
- **Temps Réel** : Socket.io-client

### Backend & Infrastructure

- **Serveur** : Nitro (Moteur de Nuxt)
- **Base de données** : PostgreSQL hébergé sur Neon/Railway
- **ORM** : Drizzle ORM
- **Stockage Cloud** : Cloudflare R2 (Vidéos, Audios, Miniatures) - _Accès via Presigned URLs AWS S3 SDK_
- **Files d'attente (Queues)** : BullMQ + Redis (Pour le mixage asynchrone des vidéos)
- **Traitement Média** : FFmpeg (Mixage final)

### Intelligence Artificielle & Scripts

- **OpenAI Whisper** : Pour l'extraction et la génération précise des timecodes depuis des vidéos Youtube/Dailymotion.
- **Replicate (Demucs)** / **Hugging Face** : Modèles de Machine Learning pour extraire et supprimer les voix originales des vidéos automatiquement.
- **yt-dlp** : Scraping de vidéos pour l'enrichissement de la bibliothèque.

---

## 🚀 Installation & Développement Local

### Prérequis

- [Node.js](https://nodejs.org/) v20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour lancer Postgres et Redis localement)
- [FFmpeg](https://ffmpeg.org/download.html) installé sur votre machine.

### 1. Installation

```bash
# Cloner le dépôt
git clone https://github.com/AnjahNyOny/doobleo.git
cd doobleo

# Installer les dépendances
npm install
```

### 2. Configuration Environnement

Copiez le fichier d'exemple et remplissez vos identifiants (Cloudflare R2, PostgreSQL, Tokens d'API, etc.) :

```bash
cp .env.example .env
```

> 💡 _Astuce : Pour générer vos secrets JWT & Session : `openssl rand -base64 32`_

### 3. Démarrer les services

Lancez la base de données et Redis via Docker, puis appliquez le schéma Drizzle :

```bash
# Lancer les conteneurs (DB + Redis)
docker compose up -d

# Pousser le schéma dans la base de données
npm run db:migrate
```

### 4. Lancer l'application

```bash
npm run dev
```

L'application est maintenant disponible sur [http://localhost:3000](http://localhost:3000).

---

## 🤖 Scripts Utiles pour l'Admin

### Créateur de scène magique

Pour extraire une vidéo depuis YouTube, récupérer son audio, générer les timecodes exacts de chaque réplique via _Whisper_, et préparer un fichier prêt à être importé dans l'admin :

```bash
# 1. Installez les dépendances python :
pip3 install yt-dlp openai-whisper torch

# 2. Lancez le script :
python3 scripts/doobleo_scene_builder.py "LIEN_YOUTUBE"
```

Le script téléchargera la vidéo `.mp4` et générera un `scene_import.json` à l'intérieur du dossier `scenes/` !

---

## 📄 Licence

Ce projet est privé et tous droits sont réservés. Il a été conçu et développé par l'équipe Doobleo.
