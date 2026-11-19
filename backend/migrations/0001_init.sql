-- Schéma initial / Initial schema
-- SQLite : chaque table a un id auto-incrémenté.

CREATE TABLE projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    color      TEXT    NOT NULL DEFAULT '#570df8',
    emoji      TEXT    NOT NULL DEFAULT '📁',
    archived   INTEGER NOT NULL DEFAULT 0,
    position   REAL    NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL
);

CREATE TABLE tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#64748b'
);

CREATE TABLE tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    parent_id    INTEGER REFERENCES tasks(id)    ON DELETE CASCADE,
    title        TEXT    NOT NULL,
    notes        TEXT,
    status       TEXT    NOT NULL DEFAULT 'todo',      -- todo | in_progress | done
    priority     TEXT    NOT NULL DEFAULT 'medium',    -- low | medium | high | urgent
    due_at       TEXT,
    position     REAL    NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    completed_at TEXT
);

CREATE TABLE task_tags (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent  ON tasks(parent_id);
CREATE INDEX idx_tasks_status  ON tasks(status);
CREATE INDEX idx_tasks_due     ON tasks(due_at);
