# 🎙️ Doobleo

Application web de doublage collaboratif en temps réel. Inspiré de _The Choicer Voicer_.

Les joueurs rejoignent un salon, choisissent un personnage, et enregistrent leurs répliques en suivant un prompteur synchronisé. Le résultat est un MP4 téléchargeable mixé par FFmpeg.

---

## ✨ Fonctionnalités

- 🎮 **Jeu en temps réel** — Salons multijoueurs (jusqu'à 6 joueurs) via WebSockets
- 🎤 **Enregistrement navigateur** — Zéro installation, 100% Web Audio API
- 🎬 **Mixage FFmpeg** — Export MP4 qualité pro avec toutes les voix assemblées
- 🎛️ **CMS sur-mesure** — Interface admin pour gérer les scènes, personnages et répliques
- 👤 **Auth hybride** — Compte ou mode invité (pseudo temporaire)

---

## 🛠️ Stack

| Couche          | Technologie                                 |
| --------------- | ------------------------------------------- |
| Frontend        | Nuxt 4, Vue 3, Pinia, Tailwind CSS v4, GSAP |
| Backend         | Nitro (Nuxt), Socket.io                     |
| Base de données | PostgreSQL + Drizzle ORM                    |
| Stockage        | Cloudflare R2 (vidéos, audio, MP4 finaux)   |
| Mixage          | FFmpeg + BullMQ + Redis                     |
| Auth            | nuxt-auth-utils + JWT                       |
| Déploiement     | Vercel (frontend) + Railway (backend + DB)  |

---

## 🚀 Installation locale

### Prérequis

- [Node.js](https://nodejs.org/) v24+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour PostgreSQL et Redis)

### 1. Cloner le repo

```bash
git clone https://github.com/TON_USERNAME/doobleo.git
cd doobleo
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Puis édite `.env` et renseigne les valeurs manquantes (DB, S3, JWT secret, etc.).

> 💡 Pour générer un secret sécurisé : `openssl rand -base64 32`

### 4. Démarrer la base de données

```bash
docker compose up -d
```

### 5. Appliquer les migrations

```bash
npm run db:migrate
```

### 6. Lancer le serveur de développement

```bash
npm run dev
```

L'app est disponible sur [http://localhost:3000](http://localhost:3000).

---

## 📋 Scripts disponibles

| Commande               | Description                            |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Serveur de développement               |
| `npm run build`        | Build de production                    |
| `npm run lint`         | Vérification ESLint                    |
| `npm run lint:fix`     | Correction automatique ESLint          |
| `npm run format`       | Formatage Prettier                     |
| `npm run typecheck`    | Vérification TypeScript                |
| `npm run db:generate`  | Générer une migration depuis le schéma |
| `npm run db:migrate`   | Appliquer les migrations               |
| `npm run db:studio`    | Interface visuelle Drizzle Studio      |
| `docker compose up -d` | Démarrer PostgreSQL + Redis            |
| `docker compose down`  | Arrêter les services                   |

---

## 📁 Structure du projet

```
doobleo/
├── app/                    # Frontend Nuxt
│   ├── pages/              # Routes de l'application
│   ├── components/         # Composants Vue réutilisables
│   ├── composables/        # Composables Vue (logique réutilisable)
│   ├── stores/             # Stores Pinia
│   └── assets/             # CSS, images
├── server/                 # Backend Nitro
│   ├── api/                # Routes API REST
│   ├── plugins/            # Plugins serveur (Socket.io, DB)
│   ├── utils/              # Utilitaires serveur
│   └── db/
│       ├── schema/         # Schéma Drizzle ORM
│       └── migrations/     # Migrations PostgreSQL
├── shared/
│   └── types/              # Types TypeScript partagés front/back
├── .github/workflows/      # GitHub Actions CI/CD
├── docker-compose.yml      # PostgreSQL + Redis locaux
├── drizzle.config.ts       # Config Drizzle Kit
├── nuxt.config.ts          # Config Nuxt
└── .env.example            # Variables d'environnement (modèle)
```

---

## 📖 Documentation

- [ROADMAP.md](./ROADMAP.md) — Plan de développement complet
- [USER_STORIES.md](./USER_STORIES.md) — User stories et critères d'acceptation

---

## 📄 Licence

Projet privé — Tous droits réservés.
