use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::state::{is_authenticated, SharedState};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthStatusResponse {
    pub authenticated: bool,
}

pub async fn login(
    State(state): State<SharedState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    if req.username == state.auth.username && req.password == state.auth.password {
        let token = Uuid::new_v4().to_string();
        {
            let mut sessions = state.sessions.write().await;
            sessions.insert(token.clone());
        }
        Ok(Json(LoginResponse { token }))
    } else {
        Err(AppError::Unauthorized)
    }
}

pub async fn logout(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<axum::http::StatusCode, AppError> {
    if let Some(token) = extract_token(&headers) {
        let mut sessions = state.sessions.write().await;
        sessions.remove(&token);
    }
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn status(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Json<AuthStatusResponse> {
    let authed = match extract_token(&headers) {
        Some(token) => is_authenticated(&state, &token).await,
        None => false,
    };
    Json(AuthStatusResponse {
        authenticated: authed,
    })
}

/// Extract bearer token from Authorization header
pub fn extract_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

/// Check auth from headers, return Err(Unauthorized) if not authenticated
pub async fn require_auth(state: &SharedState, headers: &HeaderMap) -> Result<(), AppError> {
    match extract_token(headers) {
        Some(token) if is_authenticated(state, &token).await => Ok(()),
        _ => Err(AppError::Unauthorized),
    }
}
