# Todo — Vike + React + daisyUI + i18next / Rust + GraphQL + SQLite

Application de gestion de tâches, construite exactement avec la pile imposée :

| Partie       | Technologies                                                        |
| ------------ | ------------------------------------------------------------------- |
| **Frontend** | Vike (SSR + pré-rendu) · React 19 · Tailwind 4 + daisyUI 5 · i18next (FR/EN) · TypeScript |
| **Backend**  | Rust · axum · async-graphql · SQLx · SQLite                          |
| **Hébergement** | GitHub Pages (frontend, statique) · backend à héberger ailleurs  |

L'application est **« local-first »** : elle enregistre tout dans le navigateur
et fonctionne sans backend. Quand le serveur Rust est joignable, les
modifications faites hors ligne lui sont envoyées automatiquement.

---

## 1. Démarrage rapide

Deux terminaux, deux commandes.

**Terminal 1 — le backend (API GraphQL)**

```bash
cd backend
cargo run
```

→ API sur <http://localhost:8080/graphql>
→ Console de test GraphiQL sur <http://localhost:8080/>

La base `todo.db` est créée automatiquement au premier lancement, les tables
aussi (migrations), et un jeu de données de démonstration est inséré.

**Terminal 2 — le frontend**

```bash
cd frontend
npm install     # la première fois seulement
npm run dev
```

→ Application sur <http://localhost:3000/>

> Les deux doivent tourner en même temps : le frontend interroge le backend.

---

## 2. Ce que l'application sait faire

- **Tâches** : titre, notes, statut (à faire / en cours / terminée), priorité
  (basse → urgente), échéance, étiquettes, sous-tâches.
- **Projets** : couleur, icône, avancement en %, archivage, suppression en
  cascade.
- **Étiquettes** multicolores, partagées entre les tâches.
- **Saisie rapide** avec une mini-syntaxe :
  `Rappeler le client !urgent @demain #téléphone`
  - `!low` `!medium` `!high` `!urgent` (ou `!1`…`!4`, et les mots français)
  - `@today` `@demain` `@+3d` `@2026-03-04` `@04/03`
  - `#étiquette` (créée automatiquement si elle n'existe pas)
- **Filtres** : recherche plein texte, statut, priorité, étiquettes, en retard.
- **Tris** : manuel, échéance, priorité, date de création, titre.
- **Statistiques** : à faire, en cours, pour aujourd'hui, en retard, terminées
  cette semaine, barre d'avancement.
- **Bilingue** français / anglais, changeable à chaud (i18next).
- **7 thèmes** daisyUI (clair, sombre, dracula, nord…), mémorisés.
- **Responsive** : barre latérale fixe sur grand écran, tiroir sur mobile.
- **Hors ligne complet** : tout est enregistré dans le navigateur ; les
  modifications partent vers le serveur dès qu'il répond (voir le chapitre 8).
- **Export JSON** de vos données depuis les réglages.

---

## 3. Organisation des fichiers

```
backend/
  migrations/0001_init.sql   Le schéma SQL (tables, index)
  src/model.rs               Les structures Rust (= tables = types GraphQL)
  src/db.rs                  Connexion SQLite, migrations, données de démo
  src/graphql.rs             Query (lecture) et Mutation (écriture)
  src/main.rs                Démarrage du serveur HTTP

frontend/
  pages/+config.ts           Configuration globale Vike
  pages/index/+Page.tsx      Page d'accueil (toutes les tâches)
  pages/project/+Page.tsx    Page d'un projet (/project?id=2)
  pages/settings/+Page.tsx   Réglages (langue, thème, étiquettes)
  layouts/LayoutDefault.tsx  Mise en page commune (barre latérale + en-tête)
  components/                Les briques d'interface
  lib/api.ts                 Client GraphQL + toutes les requêtes
  lib/store.tsx              État global (données + actions)
  lib/offline/state.ts       Données stockées dans le navigateur
  lib/offline/engine.ts      Les règles métier, côté client
  lib/offline/sync.ts        Rejeu de la file d'attente vers le serveur
  lib/links.ts               Liens internes (gère le préfixe GitHub Pages)
  lib/i18n.ts                Configuration i18next
  locales/fr.json, en.json   Les traductions
  css/tailwind.css           Tailwind + daisyUI
```

---

## 4. Comprendre GraphQL en 2 minutes

Contrairement à une API REST (une URL par ressource), **il n'y a qu'une seule
URL** : `/graphql`. Le client décrit ce qu'il veut, le serveur renvoie
exactement ça.

Ouvrez <http://localhost:8080/> et collez :

```graphql
query {
  tasks(filter: { overdueOnly: true }, sort: PRIORITY_DESC) {
    title
    priority
    dueAt
    project { name }
    tags { name }
  }
}
```

Créer une tâche :

```graphql
mutation {
  createTask(input: { title: "Ma première tâche", priority: HIGH }) {
    id
    title
  }
}
```

Tout le schéma est auto-documenté : onglet **Docs** dans GraphiQL.

---

## 5. Comment ajouter un champ (exemple complet)

Mettons que vous vouliez ajouter un champ `url` sur une tâche.

1. **SQL** — nouvelle migration `backend/migrations/0002_task_url.sql` :
   ```sql
   ALTER TABLE tasks ADD COLUMN url TEXT;
   ```
2. **Rust** — dans `src/model.rs` : ajoutez `pub url: Option<String>` à
   `struct Task`, à `TaskInput` et à `TaskPatch`.
3. **Rust** — dans `src/graphql.rs` : ajoutez le résolveur
   `async fn url(&self) -> Option<&str> { self.url.as_deref() }`, puis gérez le
   champ dans `create_task` / `update_task`.
4. **TypeScript** — dans `lib/api.ts` : ajoutez `url: string | null` à
   l'interface `Task` et `url` dans `TASK_FIELDS`.
5. **React** — affichez-le dans `components/TaskItem.tsx`.
6. **Traductions** — ajoutez la clé dans `locales/fr.json` et `locales/en.json`.

Relancez `cargo run` : la migration s'applique toute seule.

---

## 6. Commandes utiles

```bash
# Backend
cargo run                 # démarrer en mode développement
cargo build --release     # binaire optimisé -> target/release/todo-backend
cargo clippy              # conseils de qualité de code

# Frontend
npm run dev               # serveur de développement
npm run build             # build de production -> dist/
npm run preview           # tester le build de production
npm run typecheck         # vérifier les types TypeScript
```

Réinitialiser la base (le jeu de démo sera réinséré) :

```bash
rm backend/todo.db*
```

Réinitialiser les données du navigateur : bouton **Réinitialiser les données
locales** dans les réglages de l'application.

---

## 7. Configuration

Copiez les fichiers d'exemple si vous voulez changer les valeurs par défaut :

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```

| Variable        | Côté     | Défaut                          |
| --------------- | -------- | ------------------------------- |
| `DATABASE_URL`  | backend  | `sqlite://todo.db`              |
| `PORT`          | backend  | `8080`                          |
| `RUST_LOG`      | backend  | `info,sqlx=warn`                |
| `VITE_API_URL`  | frontend | `http://localhost:8080/graphql` |

---

## 8. Le mode hors ligne (local-first)

### Pourquoi

Le frontend est publié sur GitHub Pages, qui ne sait servir que des fichiers :
pas de serveur, donc pas d'API. L'application doit donc savoir fonctionner
seule — et cela la rend aussi utilisable dans le train.

### Comment ça marche

```
   composant React
        │  useTodos()
        ▼
   moteur local  ──────────────►  localStorage   (source de vérité immédiate)
        │
        │  chaque écriture ajoute une opération
        ▼
   file d'attente (outbox)  ────►  serveur Rust  (quand il répond)
```

| Fichier | Rôle |
| --- | --- |
| `lib/offline/state.ts`  | La forme des données stockées, la lecture/écriture localStorage, le jeu de démo |
| `lib/offline/engine.ts` | Les mêmes règles que le backend (créer, filtrer, trier, statistiques), en pur TypeScript |
| `lib/offline/sync.ts`   | Rejeu de la file, correspondance des ids, relecture du serveur |
| `lib/store.tsx`         | Le contexte React qui relie tout ça aux composants |

Les trois temps d'une synchronisation :

1. **Rejouer** — les opérations en attente partent vers GraphQL, dans l'ordre.
2. **Remapper** — une tâche créée hors ligne porte un id négatif (`-12`) ; le
   serveur lui attribue un vrai id (`42`), et `-12` est remplacé partout.
3. **Relire** — une fois la file vide, l'état du serveur est récupéré et fait
   autorité.

Détails qui comptent :

- Une bascule « terminé / à faire » est enregistrée comme un **statut absolu**,
  jamais comme un « inverse-le » : rejouer deux fois la même opération donne le
  même résultat.
- Si le réseau coupe en plein rejeu, les opérations restantes sont conservées.
- Une opération refusée par le serveur (entité déjà supprimée ailleurs) est
  abandonnée et comptée ; un bandeau l'indique.
- Le compte rendu de synchronisation est appliqué à l'état **courant**, pas à
  celui d'il y a trois secondes : une case cochée pendant l'appel réseau n'est
  jamais perdue.
- Le jeu de démonstration n'est chargé que si aucun serveur n'est joignable.
  Sinon vous modifieriez des tâches qui n'existent pas côté serveur, et ces
  modifications seraient impossibles à envoyer.

### Limite connue

Les ids sont des entiers attribués par SQLite, d'où l'étape de
« remappage ». La solution propre, le jour où le backend sera hébergé : des
identifiants **UUID générés par le navigateur**, qui supprime complètement
cette étape et les cas limites qui vont avec.

---

## 9. Déploiement

### Frontend — GitHub Pages (automatique)

Le workflow `.github/workflows/deploy-pages.yml` se déclenche à chaque push sur
`main` qui touche `frontend/`. Il construit le site et le publie.

Prérequis, une seule fois :

1. Le dépôt doit être **public** (GitHub Pages est payant sur un dépôt privé).
2. *Settings → Pages → Source* : choisir **GitHub Actions**.

Le site sera sur `https://<compte>.github.io/<depot>/`.

Trois détails rendent cela possible :

- `BASE_PATH=/<depot>/` — le site ne vit pas à la racine du domaine ;
  tous les liens passent par `href()` (`lib/links.ts`).
- `prerender: true` — Vike écrit de vrais fichiers HTML au lieu d'attendre un
  serveur.
- La page d'un projet est `/project?id=5` et non `/project/5` : un seul fichier
  `project/index.html` couvre tous les projets, ce qu'un hébergeur statique sait
  servir. (`404.html` sert de filet pour les URL inconnues.)

Pour tester le résultat exactement comme GitHub Pages le servira :

```bash
cd frontend && BASE_PATH=/first-ai-test/ VITE_API_URL= npm run build
cp dist/client/index.html dist/client/404.html
cd .. && python3 scripts/serve-pages.py 4173 /first-ai-test/
# -> http://localhost:4173/first-ai-test/
```

### Brancher un backend plus tard

Quand le serveur Rust sera hébergé quelque part :

*Settings → Secrets and variables → Actions → Variables* → créer `API_URL`
avec l'URL publique de `/graphql`. Le prochain déploiement activera la
synchronisation, sans changer une ligne de code.

⚠️ L'API devra être en **HTTPS** (une page servie en HTTPS ne peut pas appeler
une API en HTTP) et autoriser le domaine `github.io` en CORS — c'est déjà le
cas, `main.rs` autorise toutes les origines.

### Backend — pistes d'hébergement gratuit

| Service | Pour SQLite |
| --- | --- |
| **Fly.io** | Volume persistant : le fichier `todo.db` survit aux redémarrages. Le plus proche de votre setup actuel. |
| **Shuttle.rs** | Natif Rust, déploiement en une commande ; SQLite via volume ou leur Postgres. |
| **Railway / Render** | Simples, mais le disque est éphémère sur les offres gratuites → préférer Postgres (changement de `sqlx` à prévoir). |

---

## 10. Pistes pour la suite

- **Authentification** (JWT ou cookie de session) — le schéma est prêt à
  recevoir une colonne `user_id`.
- **Glisser-déposer** : la mutation `reorderTask(id, afterId)` existe déjà,
  il ne reste qu'à brancher une librairie type `dnd-kit`.
- **DataLoader** côté Rust pour supprimer les requêtes N+1 sur
  `Task.tags` / `Task.project` (invisible à cette échelle, utile à 10 000 tâches).
- **Temps réel** : async-graphql gère les `Subscription` WebSocket.
- **Tests** : `cargo test` côté Rust, Vitest + Playwright côté frontend.
- **Déploiement** : `cargo build --release` + `npm run build`, puis servez
  `frontend/dist/client` derrière le binaire Rust ou un reverse proxy.
