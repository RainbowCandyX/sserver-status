use std::time::Duration;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::checker::check_server;
use crate::error::AppError;
use crate::models::{CheckResult, SseEvent};
use crate::state::{SharedState, MAX_HISTORY};

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<usize>,
}

pub async fn history(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<CheckResult>>, AppError> {
    {
        let servers = state.servers.read().await;
        if !servers.contains_key(&id) {
            return Err(AppError::NotFound(id));
        }
    }

    let results = state.results.read().await;
    let history = results.get(&id).cloned().unwrap_or_default();

    let limit = query.limit.unwrap_or(MAX_HISTORY);
    let history: Vec<CheckResult> = history.into_iter().take(limit).collect();

    Ok(Json(history))
}

pub async fn trigger_check(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CheckResult>, AppError> {
    let server = {
        let servers = state.servers.read().await;
        servers.get(&id).cloned().ok_or(AppError::NotFound(id))?
    };

    let tcp_timeout = Duration::from_secs(state.tcp_timeout_secs);
    let ss_timeout = Duration::from_secs(state.ss_timeout_secs);
    let result = check_server(&server, tcp_timeout, ss_timeout, &state.test_target).await;

    // Save to SQLite
    {
        let db = state.db.lock().await;
        if let Err(e) = crate::db::insert_result(&db, &result) {
            tracing::error!("Failed to save result to db: {}", e);
        }
    }

    // Update in-memory cache
    {
        let mut results_map = state.results.write().await;
        let history = results_map.entry(id).or_default();
        history.insert(0, result.clone());
        history.truncate(MAX_HISTORY);
    }

    let _ = state.sse_tx.send(SseEvent::CheckComplete {
        result: result.clone(),
    });

    Ok(Json(result))
}
