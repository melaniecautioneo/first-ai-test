# Todo — Vike + React + daisyUI + i18next / Rust + GraphQL + SQLite

Application de gestion de tâches, construite exactement avec la pile imposée :

| Partie       | Technologies                                                        |
| ------------ | ------------------------------------------------------------------- |
| **Frontend** | Vike (SSR) · React 19 · Tailwind 4 + daisyUI 5 · i18next (FR/EN) · TypeScript |
| **Backend**  | Rust · axum · async-graphql · SQLx · SQLite                          |

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
  pages/project/@id/+Page.tsx  Page d'un projet (/project/2)
  pages/settings/+Page.tsx   Réglages (langue, thème, étiquettes)
  layouts/LayoutDefault.tsx  Mise en page commune (barre latérale + en-tête)
  components/                Les briques d'interface
  lib/api.ts                 Client GraphQL + toutes les requêtes
  lib/store.tsx              État global (données + actions)
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

## 8. Pistes pour la suite

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
