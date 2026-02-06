use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use tokio::sync::{broadcast, watch, Mutex, RwLock};
use uuid::Uuid;

use crate::config::{AppConfig, AuthConfig};
use crate::models::{CheckResult, Server, ServerStatus, SseEvent};

pub const MAX_HISTORY: usize = 100;

pub struct AppState {
    pub servers: RwLock<HashMap<Uuid, Server>>,
    pub results: RwLock<HashMap<Uuid, Vec<CheckResult>>>,
    pub db: Mutex<rusqlite::Connection>,
    pub sse_tx: broadcast::Sender<SseEvent>,
    pub config_path: Option<String>,
    pub listen: String,
    pub auth: AuthConfig,
    pub sessions: RwLock<HashSet<String>>,
    pub check_interval_secs: RwLock<u64>,
    pub interval_tx: watch::Sender<u64>,
    pub tcp_timeout_secs: u64,
    pub ss_timeout_secs: u64,
    pub test_target: String,
}

pub type SharedState = Arc<AppState>;

pub fn build_from_config(
    config: AppConfig,
    config_path: String,
    db_conn: rusqlite::Connection,
) -> SharedState {
    let (sse_tx, _) = broadcast::channel(256);
    let (interval_tx, _) = watch::channel(config.check_interval_secs);

    let mut servers = HashMap::new();
    for sc in &config.servers {
        let server = Server {
            id: sc.id,
            name: sc.name.clone(),
            host: sc.host.clone(),
            port: sc.port,
            password: sc.password.clone(),
            method: sc.method.clone(),
            enabled: sc.enabled,
            tags: sc.tags.clone(),
        };
        servers.insert(server.id, server);
    }

    // Load history from SQLite for each server
    let mut results: HashMap<Uuid, Vec<CheckResult>> = HashMap::new();
    for id in servers.keys() {
        match crate::db::load_results_for_server(&db_conn, *id, MAX_HISTORY) {
            Ok(history) => {
                if !history.is_empty() {
                    results.insert(*id, history);
                }
            }
            Err(e) => tracing::warn!("Failed to load history for {}: {}", id, e),
        }
    }

    Arc::new(AppState {
        servers: RwLock::new(servers),
        results: RwLock::new(results),
        db: Mutex::new(db_conn),
        sse_tx,
        config_path: Some(config_path),
        listen: config.listen,
        auth: config.auth,
        sessions: RwLock::new(HashSet::new()),
        check_interval_secs: RwLock::new(config.check_interval_secs),
        interval_tx,
        tcp_timeout_secs: config.tcp_timeout_secs,
        ss_timeout_secs: config.ss_timeout_secs,
        test_target: config.test_target,
    })
}

pub async fn is_authenticated(state: &AppState, token: &str) -> bool {
    let sessions = state.sessions.read().await;
    sessions.contains(token)
}

pub async fn get_server_statuses(state: &AppState) -> Vec<ServerStatus> {
    let servers = state.servers.read().await;
    let results = state.results.read().await;

    servers
        .values()
        .map(|server| {
            let history = results.get(&server.id).cloned().unwrap_or_default();

            let latest_result = history.first().cloned();

            let tcp_checks: Vec<&CheckResult> =
                history.iter().filter(|r| r.tcp_check.reachable).collect();

            let uptime_pct = if history.is_empty() {
                0.0
            } else {
                (tcp_checks.len() as f64 / history.len() as f64) * 100.0
            };

            let latencies: Vec<f64> = history
                .iter()
                .filter_map(|r| r.tcp_check.latency_ms)
                .collect();

            let avg_latency_ms = if latencies.is_empty() {
                None
            } else {
                Some(latencies.iter().sum::<f64>() / latencies.len() as f64)
            };

            ServerStatus {
                server: server.clone(),
                latest_result,
                history,
                uptime_pct,
                avg_latency_ms,
            }
        })
        .collect()
}
