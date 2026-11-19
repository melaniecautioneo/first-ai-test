//! Connexion SQLite, migrations et jeu de données de démonstration.

use anyhow::Result;
use chrono::{Duration, Utc};
use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;

pub type Db = SqlitePool;

/// Ouvre (ou crée) la base puis applique les migrations de `./migrations`.
pub async fn connect(database_url: &str) -> Result<Db> {
    let opts = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .foreign_keys(true)
        // WAL : meilleures performances en lecture/écriture concurrentes.
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

/// Insère quelques projets/tâches la première fois, pour que l'app
/// ne soit pas vide au premier lancement.
pub async fn seed_if_empty(pool: &Db) -> Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects")
        .fetch_one(pool)
        .await?;
    if count > 0 {
        return Ok(());
    }

    let now = Utc::now();

    let projects = [
        ("Travail", "#570df8", "💼", 0.0),
        ("Perso", "#37cdbe", "🏡", 1.0),
        ("Apprentissage", "#f59e0b", "📚", 2.0),
    ];
    let mut project_ids = Vec::new();
    for (name, color, emoji, pos) in projects {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO projects (name, color, emoji, position, created_at)
             VALUES (?, ?, ?, ?, ?) RETURNING id",
        )
        .bind(name)
        .bind(color)
        .bind(emoji)
        .bind(pos)
        .bind(now)
        .fetch_one(pool)
        .await?;
        project_ids.push(id);
    }

    let tags = [
        ("urgent", "#ef4444"),
        ("réunion", "#3b82f6"),
        ("idée", "#a855f7"),
        ("courses", "#22c55e"),
    ];
    let mut tag_ids = Vec::new();
    for (name, color) in tags {
        let id: i64 =
            sqlx::query_scalar("INSERT INTO tags (name, color) VALUES (?, ?) RETURNING id")
                .bind(name)
                .bind(color)
                .fetch_one(pool)
                .await?;
        tag_ids.push(id);
    }

    // (titre, projet, statut, priorité, échéance en jours, tags)
    type SeedTask = (
        &'static str,
        usize,
        &'static str,
        &'static str,
        Option<i64>,
        &'static [usize],
    );
    let tasks: [SeedTask; 9] = [
        (
            "Préparer la revue de sprint",
            0,
            "in_progress",
            "high",
            Some(1),
            &[1],
        ),
        (
            "Répondre aux e-mails clients",
            0,
            "todo",
            "urgent",
            Some(0),
            &[0],
        ),
        (
            "Mettre à jour la documentation API",
            0,
            "todo",
            "medium",
            Some(5),
            &[],
        ),
        (
            "Corriger le bug de connexion",
            0,
            "done",
            "urgent",
            Some(-2),
            &[0],
        ),
        ("Faire les courses", 1, "todo", "low", Some(2), &[3]),
        (
            "Réserver le billet de train",
            1,
            "todo",
            "medium",
            Some(-1),
            &[],
        ),
        ("Appeler le garage", 1, "done", "low", Some(-3), &[]),
        (
            "Finir le chapitre sur GraphQL",
            2,
            "in_progress",
            "medium",
            Some(3),
            &[2],
        ),
        (
            "Exercices Rust : ownership",
            2,
            "todo",
            "high",
            Some(7),
            &[2],
        ),
    ];

    for (i, (title, p, status, priority, due_days, tag_idx)) in tasks.iter().enumerate() {
        // Échéance = fin d'après-midi du jour visé (17 h), plus réaliste
        // qu'un horodatage à la seconde près.
        let due = due_days.map(|d| {
            (now + Duration::days(d))
                .date_naive()
                .and_hms_opt(17, 0, 0)
                .unwrap()
                .and_utc()
        });
        let completed = if *status == "done" {
            Some(now - Duration::days(1))
        } else {
            None
        };
        let task_id: i64 = sqlx::query_scalar(
            "INSERT INTO tasks
               (project_id, title, status, priority, due_at, position, created_at, updated_at, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        )
        .bind(project_ids[*p])
        .bind(*title)
        .bind(*status)
        .bind(*priority)
        .bind(due)
        .bind(i as f64)
        .bind(now)
        .bind(now)
        .bind(completed)
        .fetch_one(pool)
        .await?;

        for t in tag_idx.iter() {
            sqlx::query("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)")
                .bind(task_id)
                .bind(tag_ids[*t])
                .execute(pool)
                .await?;
        }
    }

    // Quelques sous-tâches pour montrer la hiérarchie.
    let parent: i64 = sqlx::query_scalar("SELECT id FROM tasks WHERE title = ?")
        .bind("Préparer la revue de sprint")
        .fetch_one(pool)
        .await?;
    for (i, sub) in [
        "Rassembler les métriques",
        "Écrire les slides",
        "Répéter la démo",
    ]
    .iter()
    .enumerate()
    {
        sqlx::query(
            "INSERT INTO tasks (project_id, parent_id, title, status, priority, position, created_at, updated_at)
             VALUES ((SELECT project_id FROM tasks WHERE id = ?), ?, ?, 'todo', 'medium', ?, ?, ?)",
        )
        .bind(parent)
        .bind(parent)
        .bind(*sub)
        .bind(i as f64)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;
    }

    tracing::info!("base vide -> jeu de démonstration inséré");
    Ok(())
}
