use axum::routing::{get, post, put};
use axum::Router;

use crate::state::SharedState;

pub mod auth;
mod results;
pub mod servers;
mod settings;
mod sse;

pub fn router(state: SharedState) -> Router {
    Router::new()
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/status", get(auth::status))
        .route("/api/servers", get(servers::list).post(servers::create))
        .route(
            "/api/servers/{id}",
            put(servers::update).delete(servers::delete),
        )
        .route("/api/servers/{id}/check", post(results::trigger_check))
        .route("/api/results/{id}", get(results::history))
        .route(
            "/api/settings",
            get(settings::get_settings).put(settings::update_settings),
        )
        .route("/api/events", get(sse::event_stream))
        .fallback(crate::frontend::static_handler)
        .with_state(state)
}
