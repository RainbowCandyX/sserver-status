use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::SharedState;

use super::auth::require_auth;

#[derive(Debug, Serialize)]
pub struct SettingsResponse {
    pub check_interval_secs: u64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub check_interval_secs: Option<u64>,
}

pub async fn get_settings(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<Json<SettingsResponse>, AppError> {
    require_auth(&state, &headers).await?;
    let interval = *state.check_interval_secs.read().await;
    Ok(Json(SettingsResponse {
        check_interval_secs: interval,
    }))
}

pub async fn update_settings(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<UpdateSettingsRequest>,
) -> Result<Json<SettingsResponse>, AppError> {
    require_auth(&state, &headers).await?;

    if let Some(interval) = req.check_interval_secs {
        if interval < 5 {
            return Err(AppError::BadRequest(
                "check_interval_secs must be >= 5".into(),
            ));
        }
        {
            let mut current = state.check_interval_secs.write().await;
            *current = interval;
        }
        let _ = state.interval_tx.send(interval);
    }

    // Persist to config file
    if let Err(e) = crate::config::persist(&state).await {
        tracing::error!("Failed to persist config: {}", e);
    }

    let interval = *state.check_interval_secs.read().await;
    Ok(Json(SettingsResponse {
        check_interval_secs: interval,
    }))
}
