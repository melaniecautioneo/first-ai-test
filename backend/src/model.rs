//! Les "formes" de données partagées entre SQLite et GraphQL.
//!
//! Chaque struct sert deux fois :
//!   - `sqlx::FromRow` : comment lire une ligne SQLite
//!   - `async_graphql::SimpleObject` : comment l'exposer en GraphQL

use async_graphql::{Enum, InputObject, SimpleObject};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Énumérations
// ---------------------------------------------------------------------------

/// Statut d'une tâche. Stocké en TEXT ('todo'), exposé en GraphQL (TODO).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum, sqlx::Type, Serialize, Deserialize)]
#[sqlx(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum, sqlx::Type, Serialize, Deserialize)]
#[sqlx(rename_all = "snake_case")]
pub enum Priority {
    Low,
    Medium,
    High,
    Urgent,
}

/// Ordre de tri demandé par le client.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TaskSort {
    CreatedDesc,
    CreatedAsc,
    DueAsc,
    DueDesc,
    PriorityDesc,
    TitleAsc,
    Manual,
}

impl TaskSort {
    /// Fragment SQL correspondant. Jamais construit depuis une saisie
    /// utilisateur libre -> pas d'injection SQL possible.
    pub fn to_sql(self) -> &'static str {
        match self {
            TaskSort::CreatedDesc => "t.created_at DESC",
            TaskSort::CreatedAsc => "t.created_at ASC",
            TaskSort::DueAsc => "t.due_at IS NULL, t.due_at ASC",
            TaskSort::DueDesc => "t.due_at IS NULL, t.due_at DESC",
            TaskSort::PriorityDesc => {
                "CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 \
                 WHEN 'medium' THEN 2 ELSE 3 END ASC, t.due_at IS NULL, t.due_at ASC"
            }
            TaskSort::TitleAsc => "t.title COLLATE NOCASE ASC",
            TaskSort::Manual => "t.position ASC, t.id ASC",
        }
    }
}

// ---------------------------------------------------------------------------
// Entités
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub emoji: String,
    pub archived: bool,
    pub position: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, SimpleObject, sqlx::FromRow)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Task {
    pub id: i64,
    pub project_id: Option<i64>,
    pub parent_id: Option<i64>,
    pub title: String,
    pub notes: Option<String>,
    pub status: TaskStatus,
    pub priority: Priority,
    pub due_at: Option<DateTime<Utc>>,
    pub position: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Compteurs affichés sur le tableau de bord.
#[derive(Debug, Clone, SimpleObject)]
pub struct Stats {
    pub total: i64,
    pub todo: i64,
    pub in_progress: i64,
    pub done: i64,
    pub overdue: i64,
    pub due_today: i64,
    pub completed_this_week: i64,
}

// ---------------------------------------------------------------------------
// Entrées (arguments de mutations)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, InputObject)]
pub struct ProjectInput {
    pub name: String,
    pub color: Option<String>,
    pub emoji: Option<String>,
}

#[derive(Debug, Clone, Default, InputObject)]
pub struct ProjectPatch {
    pub name: Option<String>,
    pub color: Option<String>,
    pub emoji: Option<String>,
    pub archived: Option<bool>,
}

#[derive(Debug, Clone, InputObject)]
pub struct TaskInput {
    pub title: String,
    pub notes: Option<String>,
    pub project_id: Option<i64>,
    pub parent_id: Option<i64>,
    pub priority: Option<Priority>,
    pub status: Option<TaskStatus>,
    pub due_at: Option<DateTime<Utc>>,
    #[graphql(default)]
    pub tag_ids: Vec<i64>,
}

/// Mise à jour partielle : chaque champ absent = "ne change pas".
/// `due_at` utilise une sémantique explicite via `clear_due_at`.
#[derive(Debug, Clone, Default, InputObject)]
pub struct TaskPatch {
    pub title: Option<String>,
    pub notes: Option<String>,
    pub project_id: Option<i64>,
    pub priority: Option<Priority>,
    pub status: Option<TaskStatus>,
    pub due_at: Option<DateTime<Utc>>,
    #[graphql(default)]
    pub clear_due_at: bool,
    #[graphql(default)]
    pub clear_project: bool,
    pub tag_ids: Option<Vec<i64>>,
}

/// Filtres de la requête `tasks`.
#[derive(Debug, Clone, Default, InputObject)]
pub struct TaskFilter {
    pub project_id: Option<i64>,
    #[graphql(default)]
    pub no_project: bool,
    pub status: Option<Vec<TaskStatus>>,
    pub priority: Option<Vec<Priority>>,
    pub tag_ids: Option<Vec<i64>>,
    /// Recherche plein texte simple sur le titre et les notes.
    pub search: Option<String>,
    pub due_before: Option<DateTime<Utc>>,
    #[graphql(default)]
    pub overdue_only: bool,
    /// `true` = uniquement les tâches racines (sans parent).
    #[graphql(default = true)]
    pub roots_only: bool,
}
