mod api;
mod checker;
mod config;
mod db;
mod error;
mod frontend;
mod models;
mod scheduler;
mod state;

use std::sync::Arc;

use clap::Parser;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "sserver-status", about = "Shadowsocks server connectivity monitor")]
struct Cli {
    /// Path to config file
    #[arg(short, long, default_value = "config.yaml")]
    config: String,

    /// Override listen address (e.g. 0.0.0.0:3000)
    #[arg(short, long)]
    listen: Option<String>,

    /// Path to SQLite database file
    #[arg(short, long, default_value = "sserver-status.db")]
    db: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            EnvFilter::new("sserver_status=info,tower_http=info")
        }))
        .init();

    let cli = Cli::parse();

    let app_config = config::load(&cli.config)?;
    let listen_addr = cli.listen.unwrap_or_else(|| app_config.listen.clone());

    let db_conn = db::init(&cli.db)?;
    tracing::info!("Database opened: {}", cli.db);

    // Cleanup old records on startup
    match db::cleanup_old(&db_conn, 7) {
        Ok(n) if n > 0 => tracing::info!("Cleaned up {} old records on startup", n),
        Err(e) => tracing::warn!("Failed to cleanup old records: {}", e),
        _ => {}
    }

    let shared_state = state::build_from_config(app_config, cli.config, db_conn);

    // Persist config to save generated server IDs
    if let Err(e) = config::persist(&shared_state).await {
        tracing::warn!("Failed to persist config on startup: {}", e);
    }

    // Start periodic health check scheduler
    let _scheduler = scheduler::start_scheduler(Arc::clone(&shared_state));

    let app = api::router(shared_state).layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&listen_addr).await?;
    tracing::info!("Listening on http://{}", listen_addr);

    axum::serve(listener, app).await?;

    Ok(())
}
