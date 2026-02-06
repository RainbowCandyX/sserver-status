use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::Json;
use uuid::Uuid;

use std::time::Duration;

use crate::api::auth::{extract_token, require_auth};
use crate::checker::check_server;
use crate::config;
use crate::error::AppError;
use crate::models::{CreateServerRequest, PublicServerStatus, Server, SseEvent};
use crate::state::{get_server_statuses, is_authenticated, SharedState, MAX_HISTORY};

/// GET /api/servers
/// Unauthenticated: returns PublicServerStatus (no host/port/password/method)
/// Authenticated: returns full ServerStatus
pub async fn list(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let statuses = get_server_statuses(&state).await;

    let authed = match extract_token(&headers) {
        Some(token) => is_authenticated(&state, &token).await,
        None => false,
    };

    if authed {
        Ok(Json(serde_json::to_value(&statuses).unwrap()).into_response())
    } else {
        let public: Vec<PublicServerStatus> = statuses.iter().map(PublicServerStatus::from).collect();
        Ok(Json(serde_json::to_value(&public).unwrap()).into_response())
    }
}

/// POST /api/servers — requires auth
pub async fn create(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<CreateServerRequest>,
) -> Result<Json<Server>, AppError> {
    require_auth(&state, &headers).await?;

    if req.name.is_empty() || req.host.is_empty() || req.password.is_empty() {
        return Err(AppError::BadRequest(
            "name, host, and password are required".into(),
        ));
    }

    let server = req.into_server();
    {
        let mut servers = state.servers.write().await;
        servers.insert(server.id, server.clone());
    }

    let _ = state.sse_tx.send(SseEvent::ServerUpdated {
        server: server.clone(),
    });

    if let Err(e) = config::persist(&state).await {
        tracing::error!("Failed to persist config: {}", e);
    }

    // Trigger immediate check in background
    if server.enabled {
        let state = state.clone();
        let server = server.clone();
        tokio::spawn(async move {
            let tcp_timeout = Duration::from_secs(state.tcp_timeout_secs);
            let ss_timeout = Duration::from_secs(state.ss_timeout_secs);
            let result =
                check_server(&server, tcp_timeout, ss_timeout, &state.test_target).await;
            {
                let db = state.db.lock().await;
                let _ = crate::db::insert_result(&db, &result);
            }
            {
                let mut results_map = state.results.write().await;
                let history = results_map.entry(server.id).or_default();
                history.insert(0, result.clone());
                history.truncate(MAX_HISTORY);
            }
            let _ = state.sse_tx.send(SseEvent::CheckComplete { result });
        });
    }

    Ok(Json(server))
}

/// PUT /api/servers/:id — requires auth
pub async fn update(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<CreateServerRequest>,
) -> Result<Json<Server>, AppError> {
    require_auth(&state, &headers).await?;

    let mut servers = state.servers.write().await;
    let existing = servers.get(&id).ok_or(AppError::NotFound(id))?;

    let server = Server {
        id: existing.id,
        name: req.name,
        host: req.host,
        port: req.port,
        password: req.password,
        method: req.method,
        enabled: req.enabled,
        tags: req.tags,
    };

    servers.insert(id, server.clone());
    drop(servers);

    let _ = state.sse_tx.send(SseEvent::ServerUpdated {
        server: server.clone(),
    });

    if let Err(e) = config::persist(&state).await {
        tracing::error!("Failed to persist config: {}", e);
    }

    Ok(Json(server))
}

/// DELETE /api/servers/:id — requires auth
pub async fn delete(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    require_auth(&state, &headers).await?;

    {
        let mut servers = state.servers.write().await;
        if servers.remove(&id).is_none() {
            return Err(AppError::NotFound(id));
        }
    }

    {
        let mut results = state.results.write().await;
        results.remove(&id);
    }

    let _ = state.sse_tx.send(SseEvent::ServerRemoved { server_id: id });

    if let Err(e) = config::persist(&state).await {
        tracing::error!("Failed to persist config: {}", e);
    }

    Ok(axum::http::StatusCode::NO_CONTENT)
}
