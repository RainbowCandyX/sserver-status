use std::time::Duration;

use tokio::task::JoinHandle;

use crate::checker::check_server;
use crate::models::{Server, SseEvent};
use crate::state::{SharedState, MAX_HISTORY};

const KEEP_DAYS: i64 = 7;

pub fn start_scheduler(state: SharedState) -> JoinHandle<()> {
    let mut interval_rx = state.interval_tx.subscribe();

    tokio::spawn(async move {
        let mut secs = *interval_rx.borrow_and_update();
        let mut interval = tokio::time::interval(Duration::from_secs(secs));
        let mut check_count: u64 = 0;

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    run_all_checks(&state).await;

                    // Cleanup old records every ~100 checks
                    check_count += 1;
                    if check_count % 100 == 0 {
                        cleanup_db(&state).await;
                    }
                }
                Ok(()) = interval_rx.changed() => {
                    secs = *interval_rx.borrow_and_update();
                    tracing::info!("Check interval changed to {}s", secs);
                    interval = tokio::time::interval(Duration::from_secs(secs));
                    interval.tick().await;
                }
            }
        }
    })
}

pub async fn run_all_checks(state: &SharedState) {
    let servers: Vec<Server> = {
        let map = state.servers.read().await;
        map.values().filter(|s| s.enabled).cloned().collect()
    };

    if servers.is_empty() {
        return;
    }

    let tcp_timeout = Duration::from_secs(state.tcp_timeout_secs);
    let ss_timeout = Duration::from_secs(state.ss_timeout_secs);
    let test_target = state.test_target.clone();

    let futures: Vec<_> = servers
        .iter()
        .map(|server| {
            let server = server.clone();
            let test_target = test_target.clone();
            async move { check_server(&server, tcp_timeout, ss_timeout, &test_target).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Save to SQLite
    {
        let db = state.db.lock().await;
        for result in &results {
            if let Err(e) = crate::db::insert_result(&db, result) {
                tracing::error!("Failed to save result to db: {}", e);
            }
        }
    }

    // Update in-memory cache
    {
        let mut results_map = state.results.write().await;
        for result in &results {
            let history = results_map.entry(result.server_id).or_default();
            history.insert(0, result.clone());
            history.truncate(MAX_HISTORY);
        }
    }

    for result in results {
        let _ = state.sse_tx.send(SseEvent::CheckComplete { result });
    }
}

async fn cleanup_db(state: &SharedState) {
    let db = state.db.lock().await;
    match crate::db::cleanup_old(&db, KEEP_DAYS) {
        Ok(deleted) => {
            if deleted > 0 {
                tracing::info!("Cleaned up {} old check results (>{} days)", deleted, KEEP_DAYS);
            }
        }
        Err(e) => tracing::error!("Failed to cleanup old results: {}", e),
    }
}
