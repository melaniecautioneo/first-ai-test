//! Point d'entrée du serveur.
//!
//!   GET  /            -> interface GraphiQL (pour tester les requêtes)
//!   POST /graphql     -> l'API GraphQL
//!   GET  /health      -> vérification simple

mod db;
mod graphql;
mod model;

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::GraphQL;
use axum::{
    Router,
    response::{Html, IntoResponse},
    routing::get,
};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};

async fn graphiql() -> impl IntoResponse {
    Html(GraphiQLSource::build().endpoint("/graphql").finish())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,sqlx=warn".into()),
        )
        .init();

    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://todo.db".to_string());
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let pool = db::connect(&database_url).await?;
    db::seed_if_empty(&pool).await?;

    let schema = graphql::build_schema(pool);

    // En dev, le front tourne sur un autre port (3000) : on autorise le CORS.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(graphiql))
        .route("/health", get(|| async { "ok" }))
        .route_service("/graphql", GraphQL::new(schema))
        .layer(cors);

    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("API GraphQL  -> http://localhost:{port}/graphql");
    tracing::info!("GraphiQL     -> http://localhost:{port}/");
    axum::serve(listener, app).await?;
    Ok(())
}
