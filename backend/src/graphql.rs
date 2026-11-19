//! Le schéma GraphQL : Query (lecture) + Mutation (écriture).
//!
//! Tout passe par un seul endpoint : POST /graphql

use async_graphql::{Context, EmptySubscription, Object, Result, Schema};
use chrono::{DateTime, Duration, Utc};
use sqlx::{QueryBuilder, Sqlite};

use crate::db::Db;
use crate::model::*;

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn build_schema(db: Db) -> AppSchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(db)
        .finish()
}

fn db<'a>(ctx: &'a Context<'_>) -> &'a Db {
    ctx.data_unchecked::<Db>()
}

// ===========================================================================
// Résolveurs d'objets
// ===========================================================================

#[Object]
impl Project {
    async fn id(&self) -> i64 {
        self.id
    }
    async fn name(&self) -> &str {
        &self.name
    }
    async fn color(&self) -> &str {
        &self.color
    }
    async fn emoji(&self) -> &str {
        &self.emoji
    }
    async fn archived(&self) -> bool {
        self.archived
    }
    async fn position(&self) -> f64 {
        self.position
    }
    async fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// Nombre total de tâches (sous-tâches incluses).
    async fn task_count(&self, ctx: &Context<'_>) -> Result<i64> {
        Ok(
            sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE project_id = ?")
                .bind(self.id)
                .fetch_one(db(ctx))
                .await?,
        )
    }

    async fn done_count(&self, ctx: &Context<'_>) -> Result<i64> {
        Ok(sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status = 'done'",
        )
        .bind(self.id)
        .fetch_one(db(ctx))
        .await?)
    }
}

#[Object]
impl Task {
    async fn id(&self) -> i64 {
        self.id
    }
    async fn title(&self) -> &str {
        &self.title
    }
    async fn notes(&self) -> Option<&str> {
        self.notes.as_deref()
    }
    async fn status(&self) -> TaskStatus {
        self.status
    }
    async fn priority(&self) -> Priority {
        self.priority
    }
    async fn due_at(&self) -> Option<DateTime<Utc>> {
        self.due_at
    }
    async fn position(&self) -> f64 {
        self.position
    }
    async fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }
    async fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }
    async fn completed_at(&self) -> Option<DateTime<Utc>> {
        self.completed_at
    }
    async fn parent_id(&self) -> Option<i64> {
        self.parent_id
    }
    async fn project_id(&self) -> Option<i64> {
        self.project_id
    }

    /// En retard = échéance dépassée et tâche non terminée.
    async fn overdue(&self) -> bool {
        match (self.due_at, self.status) {
            (Some(d), s) if s != TaskStatus::Done => d < Utc::now(),
            _ => false,
        }
    }

    async fn project(&self, ctx: &Context<'_>) -> Result<Option<Project>> {
        let Some(pid) = self.project_id else {
            return Ok(None);
        };
        Ok(
            sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
                .bind(pid)
                .fetch_optional(db(ctx))
                .await?,
        )
    }

    async fn tags(&self, ctx: &Context<'_>) -> Result<Vec<Tag>> {
        Ok(sqlx::query_as::<_, Tag>(
            "SELECT g.* FROM tags g
             JOIN task_tags tt ON tt.tag_id = g.id
             WHERE tt.task_id = ? ORDER BY g.name COLLATE NOCASE",
        )
        .bind(self.id)
        .fetch_all(db(ctx))
        .await?)
    }

    async fn subtasks(&self, ctx: &Context<'_>) -> Result<Vec<Task>> {
        Ok(sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE parent_id = ? ORDER BY position, id",
        )
        .bind(self.id)
        .fetch_all(db(ctx))
        .await?)
    }
}

// ===========================================================================
// Query
// ===========================================================================

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// Liste des projets.
    async fn projects(
        &self,
        ctx: &Context<'_>,
        #[graphql(default = false)] include_archived: bool,
    ) -> Result<Vec<Project>> {
        let sql = if include_archived {
            "SELECT * FROM projects ORDER BY position, id"
        } else {
            "SELECT * FROM projects WHERE archived = 0 ORDER BY position, id"
        };
        Ok(sqlx::query_as::<_, Project>(sql).fetch_all(db(ctx)).await?)
    }

    async fn project(&self, ctx: &Context<'_>, id: i64) -> Result<Option<Project>> {
        Ok(
            sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
                .bind(id)
                .fetch_optional(db(ctx))
                .await?,
        )
    }

    async fn tags(&self, ctx: &Context<'_>) -> Result<Vec<Tag>> {
        Ok(
            sqlx::query_as::<_, Tag>("SELECT * FROM tags ORDER BY name COLLATE NOCASE")
                .fetch_all(db(ctx))
                .await?,
        )
    }

    async fn task(&self, ctx: &Context<'_>, id: i64) -> Result<Option<Task>> {
        Ok(
            sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
                .bind(id)
                .fetch_optional(db(ctx))
                .await?,
        )
    }

    /// Liste filtrée/triée de tâches. C'est la requête principale de l'app.
    async fn tasks(
        &self,
        ctx: &Context<'_>,
        filter: Option<TaskFilter>,
        #[graphql(default_with = "TaskSort::Manual")] sort: TaskSort,
        #[graphql(default = 200)] limit: i32,
        #[graphql(default = 0)] offset: i32,
    ) -> Result<Vec<Task>> {
        let f = filter.unwrap_or_default();
        let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("SELECT DISTINCT t.* FROM tasks t");

        if let Some(ids) = f.tag_ids.as_ref().filter(|v| !v.is_empty()) {
            qb.push(" JOIN task_tags tt ON tt.task_id = t.id AND tt.tag_id IN (");
            let mut sep = qb.separated(", ");
            for id in ids {
                sep.push_bind(*id);
            }
            qb.push(")");
        }

        qb.push(" WHERE 1=1");

        if f.roots_only {
            qb.push(" AND t.parent_id IS NULL");
        }
        if f.no_project {
            qb.push(" AND t.project_id IS NULL");
        } else if let Some(pid) = f.project_id {
            qb.push(" AND t.project_id = ").push_bind(pid);
        }
        if let Some(st) = f.status.as_ref().filter(|v| !v.is_empty()) {
            qb.push(" AND t.status IN (");
            let mut sep = qb.separated(", ");
            for s in st {
                sep.push_bind(*s);
            }
            qb.push(")");
        }
        if let Some(pr) = f.priority.as_ref().filter(|v| !v.is_empty()) {
            qb.push(" AND t.priority IN (");
            let mut sep = qb.separated(", ");
            for p in pr {
                sep.push_bind(*p);
            }
            qb.push(")");
        }
        if let Some(q) = f.search.as_ref().filter(|s| !s.trim().is_empty()) {
            let like = format!("%{}%", q.trim());
            qb.push(" AND (t.title LIKE ")
                .push_bind(like.clone())
                .push(" OR IFNULL(t.notes,'') LIKE ")
                .push_bind(like)
                .push(")");
        }
        if let Some(before) = f.due_before {
            qb.push(" AND t.due_at IS NOT NULL AND t.due_at <= ")
                .push_bind(before);
        }
        if f.overdue_only {
            qb.push(" AND t.due_at IS NOT NULL AND t.status <> 'done' AND t.due_at < ")
                .push_bind(Utc::now());
        }

        qb.push(" ORDER BY ").push(sort.to_sql());
        qb.push(" LIMIT ").push_bind(limit.clamp(1, 1000));
        qb.push(" OFFSET ").push_bind(offset.max(0));

        Ok(qb.build_query_as::<Task>().fetch_all(db(ctx)).await?)
    }

    /// Compteurs du tableau de bord (optionnellement pour un seul projet).
    async fn stats(&self, ctx: &Context<'_>, project_id: Option<i64>) -> Result<Stats> {
        let pool = db(ctx);
        let now = Utc::now();
        let end_of_day = now
            .date_naive()
            .and_hms_opt(23, 59, 59)
            .unwrap()
            .and_utc();
        let week_ago = now - Duration::days(7);

        // Le filtre "projet" est ajouté AVANT la condition, sinon un
        // `push_bind` ultérieur se retrouverait après le `AND`.
        let counter = |cond: &str| -> QueryBuilder<Sqlite> {
            let mut qb: QueryBuilder<Sqlite> =
                QueryBuilder::new("SELECT COUNT(*) FROM tasks t WHERE ");
            if let Some(p) = project_id {
                qb.push("t.project_id = ").push_bind(p).push(" AND ");
            }
            qb.push(cond);
            qb
        };

        let total: i64 = counter("1=1").build_query_scalar().fetch_one(pool).await?;
        let todo: i64 = counter("t.status = 'todo'")
            .build_query_scalar()
            .fetch_one(pool)
            .await?;
        let in_progress: i64 = counter("t.status = 'in_progress'")
            .build_query_scalar()
            .fetch_one(pool)
            .await?;
        let done: i64 = counter("t.status = 'done'")
            .build_query_scalar()
            .fetch_one(pool)
            .await?;

        let mut qb = counter("t.status <> 'done' AND t.due_at IS NOT NULL AND t.due_at < ");
        qb.push_bind(now);
        let overdue: i64 = qb.build_query_scalar().fetch_one(pool).await?;

        let mut qb = counter("t.status <> 'done' AND t.due_at IS NOT NULL AND t.due_at >= ");
        qb.push_bind(now).push(" AND t.due_at <= ").push_bind(end_of_day);
        let due_today: i64 = qb.build_query_scalar().fetch_one(pool).await?;

        let mut qb = counter("t.completed_at IS NOT NULL AND t.completed_at >= ");
        qb.push_bind(week_ago);
        let completed_this_week: i64 = qb.build_query_scalar().fetch_one(pool).await?;

        Ok(Stats {
            total,
            todo,
            in_progress,
            done,
            overdue,
            due_today,
            completed_this_week,
        })
    }
}

// ===========================================================================
// Mutation
// ===========================================================================

pub struct MutationRoot;

async fn fetch_task(pool: &Db, id: i64) -> Result<Task> {
    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| async_graphql::Error::new(format!("tâche {id} introuvable")))
}

async fn replace_tags(pool: &Db, task_id: i64, tag_ids: &[i64]) -> Result<()> {
    sqlx::query("DELETE FROM task_tags WHERE task_id = ?")
        .bind(task_id)
        .execute(pool)
        .await?;
    for t in tag_ids {
        sqlx::query("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)")
            .bind(task_id)
            .bind(*t)
            .execute(pool)
            .await?;
    }
    Ok(())
}

#[Object]
impl MutationRoot {
    // ---- Projets ----------------------------------------------------------

    async fn create_project(&self, ctx: &Context<'_>, input: ProjectInput) -> Result<Project> {
        let pool = db(ctx);
        let name = input.name.trim();
        if name.is_empty() {
            return Err(async_graphql::Error::new("le nom du projet est obligatoire"));
        }
        let next_pos: f64 =
            sqlx::query_scalar("SELECT CAST(IFNULL(MAX(position), -1) + 1 AS REAL) FROM projects")
                .fetch_one(pool)
                .await?;
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO projects (name, color, emoji, position, created_at)
             VALUES (?, ?, ?, ?, ?) RETURNING id",
        )
        .bind(name)
        .bind(input.color.unwrap_or_else(|| "#570df8".into()))
        .bind(input.emoji.unwrap_or_else(|| "📁".into()))
        .bind(next_pos)
        .bind(Utc::now())
        .fetch_one(pool)
        .await?;

        Ok(sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?)
    }

    async fn update_project(
        &self,
        ctx: &Context<'_>,
        id: i64,
        patch: ProjectPatch,
    ) -> Result<Project> {
        let pool = db(ctx);
        if let Some(n) = patch.name {
            sqlx::query("UPDATE projects SET name = ? WHERE id = ?")
                .bind(n.trim())
                .bind(id)
                .execute(pool)
                .await?;
        }
        if let Some(c) = patch.color {
            sqlx::query("UPDATE projects SET color = ? WHERE id = ?")
                .bind(c)
                .bind(id)
                .execute(pool)
                .await?;
        }
        if let Some(e) = patch.emoji {
            sqlx::query("UPDATE projects SET emoji = ? WHERE id = ?")
                .bind(e)
                .bind(id)
                .execute(pool)
                .await?;
        }
        if let Some(a) = patch.archived {
            sqlx::query("UPDATE projects SET archived = ? WHERE id = ?")
                .bind(a)
                .bind(id)
                .execute(pool)
                .await?;
        }
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| async_graphql::Error::new(format!("projet {id} introuvable")))
    }

    /// Supprime un projet. Ses tâches sont supprimées en cascade.
    async fn delete_project(&self, ctx: &Context<'_>, id: i64) -> Result<bool> {
        let res = sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(db(ctx))
            .await?;
        Ok(res.rows_affected() > 0)
    }

    // ---- Étiquettes -------------------------------------------------------

    async fn create_tag(&self, ctx: &Context<'_>, name: String, color: Option<String>) -> Result<Tag> {
        let pool = db(ctx);
        let name = name.trim().to_lowercase();
        if name.is_empty() {
            return Err(async_graphql::Error::new("le nom de l'étiquette est obligatoire"));
        }
        sqlx::query("INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)")
            .bind(&name)
            .bind(color.unwrap_or_else(|| "#64748b".into()))
            .execute(pool)
            .await?;
        Ok(sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE name = ?")
            .bind(&name)
            .fetch_one(pool)
            .await?)
    }

    async fn delete_tag(&self, ctx: &Context<'_>, id: i64) -> Result<bool> {
        let res = sqlx::query("DELETE FROM tags WHERE id = ?")
            .bind(id)
            .execute(db(ctx))
            .await?;
        Ok(res.rows_affected() > 0)
    }

    // ---- Tâches -----------------------------------------------------------

    async fn create_task(&self, ctx: &Context<'_>, input: TaskInput) -> Result<Task> {
        let pool = db(ctx);
        let title = input.title.trim();
        if title.is_empty() {
            return Err(async_graphql::Error::new("le titre est obligatoire"));
        }
        let now = Utc::now();
        let status = input.status.unwrap_or(TaskStatus::Todo);
        let next_pos: f64 = sqlx::query_scalar(
            "SELECT CAST(IFNULL(MAX(position), -1) + 1 AS REAL)
             FROM tasks WHERE IFNULL(project_id, -1) = IFNULL(?, -1)",
        )
        .bind(input.project_id)
        .fetch_one(pool)
        .await?;

        let id: i64 = sqlx::query_scalar(
            "INSERT INTO tasks (project_id, parent_id, title, notes, status, priority, due_at,
                                position, created_at, updated_at, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        )
        .bind(input.project_id)
        .bind(input.parent_id)
        .bind(title)
        .bind(input.notes.as_deref())
        .bind(status)
        .bind(input.priority.unwrap_or(Priority::Medium))
        .bind(input.due_at)
        .bind(next_pos)
        .bind(now)
        .bind(now)
        .bind(if status == TaskStatus::Done { Some(now) } else { None })
        .fetch_one(pool)
        .await?;

        if !input.tag_ids.is_empty() {
            replace_tags(pool, id, &input.tag_ids).await?;
        }
        fetch_task(pool, id).await
    }

    async fn update_task(&self, ctx: &Context<'_>, id: i64, patch: TaskPatch) -> Result<Task> {
        let pool = db(ctx);
        let current = fetch_task(pool, id).await?;
        let now = Utc::now();

        if let Some(t) = patch.title {
            let t = t.trim().to_string();
            if t.is_empty() {
                return Err(async_graphql::Error::new("le titre ne peut pas être vide"));
            }
            sqlx::query("UPDATE tasks SET title = ? WHERE id = ?")
                .bind(t)
                .bind(id)
                .execute(pool)
                .await?;
        }
        if let Some(n) = patch.notes {
            sqlx::query("UPDATE tasks SET notes = ? WHERE id = ?")
                .bind(if n.trim().is_empty() { None } else { Some(n) })
                .bind(id)
                .execute(pool)
                .await?;
        }
        if let Some(p) = patch.priority {
            sqlx::query("UPDATE tasks SET priority = ? WHERE id = ?")
                .bind(p)
                .bind(id)
                .execute(pool)
                .await?;
        }
        if patch.clear_project {
            sqlx::query("UPDATE tasks SET project_id = NULL WHERE id = ?")
                .bind(id)
                .execute(pool)
                .await?;
        } else if let Some(pid) = patch.project_id {
            sqlx::query("UPDATE tasks SET project_id = ? WHERE id = ?")
                .bind(pid)
                .bind(id)
                .execute(pool)
                .await?;
        }
        if patch.clear_due_at {
            sqlx::query("UPDATE tasks SET due_at = NULL WHERE id = ?")
                .bind(id)
                .execute(pool)
                .await?;
        } else if let Some(d) = patch.due_at {
            sqlx::query("UPDATE tasks SET due_at = ? WHERE id = ?")
                .bind(d)
                .bind(id)
                .execute(pool)
                .await?;
        }
        if let Some(s) = patch.status {
            let completed = match (s, current.status) {
                (TaskStatus::Done, TaskStatus::Done) => current.completed_at,
                (TaskStatus::Done, _) => Some(now),
                _ => None,
            };
            sqlx::query("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?")
                .bind(s)
                .bind(completed)
                .bind(id)
                .execute(pool)
                .await?;
        }
        if let Some(tags) = patch.tag_ids {
            replace_tags(pool, id, &tags).await?;
        }

        sqlx::query("UPDATE tasks SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
        fetch_task(pool, id).await
    }

    /// Bascule terminé / à faire (raccourci utilisé par la case à cocher).
    async fn toggle_task(&self, ctx: &Context<'_>, id: i64) -> Result<Task> {
        let pool = db(ctx);
        let current = fetch_task(pool, id).await?;
        let now = Utc::now();
        let (new_status, completed) = if current.status == TaskStatus::Done {
            (TaskStatus::Todo, None)
        } else {
            (TaskStatus::Done, Some(now))
        };
        sqlx::query("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?")
            .bind(new_status)
            .bind(completed)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
        fetch_task(pool, id).await
    }

    async fn delete_task(&self, ctx: &Context<'_>, id: i64) -> Result<bool> {
        let res = sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id)
            .execute(db(ctx))
            .await?;
        Ok(res.rows_affected() > 0)
    }

    /// Réordonne une tâche (glisser-déposer) : `after_id` = la tâche
    /// derrière laquelle se placer, ou `null` pour aller en première position.
    async fn reorder_task(
        &self,
        ctx: &Context<'_>,
        id: i64,
        after_id: Option<i64>,
    ) -> Result<Task> {
        let pool = db(ctx);
        let new_pos: f64 = match after_id {
            None => {
                let min: f64 = sqlx::query_scalar("SELECT CAST(IFNULL(MIN(position), 0) AS REAL) FROM tasks")
                    .fetch_one(pool)
                    .await?;
                min - 1.0
            }
            Some(after) => {
                let after_task = fetch_task(pool, after).await?;
                let next: Option<f64> = sqlx::query_scalar(
                    "SELECT CAST(MIN(position) AS REAL) FROM tasks WHERE position > ? AND id <> ?",
                )
                .bind(after_task.position)
                .bind(id)
                .fetch_one(pool)
                .await?;
                match next {
                    Some(n) => (after_task.position + n) / 2.0,
                    None => after_task.position + 1.0,
                }
            }
        };
        sqlx::query("UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?")
            .bind(new_pos)
            .bind(Utc::now())
            .bind(id)
            .execute(pool)
            .await?;
        fetch_task(pool, id).await
    }

    /// Supprime toutes les tâches terminées (d'un projet, ou de partout).
    async fn delete_completed_tasks(&self, ctx: &Context<'_>, project_id: Option<i64>) -> Result<i64> {
        let pool = db(ctx);
        let res = match project_id {
            Some(p) => {
                sqlx::query("DELETE FROM tasks WHERE status = 'done' AND project_id = ?")
                    .bind(p)
                    .execute(pool)
                    .await?
            }
            None => {
                sqlx::query("DELETE FROM tasks WHERE status = 'done'")
                    .execute(pool)
                    .await?
            }
        };
        Ok(res.rows_affected() as i64)
    }
}
