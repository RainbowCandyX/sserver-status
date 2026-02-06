use std::convert::Infallible;

use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::stream::{self, Stream, StreamExt};
use tokio_stream::wrappers::BroadcastStream;

use crate::models::PublicSseEvent;
use crate::state::{get_server_statuses, SharedState};

pub async fn event_stream(
    State(state): State<SharedState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // Build initial snapshot — always public (no sensitive data)
    let statuses = get_server_statuses(&state).await;
    let public_statuses = statuses
        .iter()
        .map(crate::models::PublicServerStatus::from)
        .collect();
    let snapshot = PublicSseEvent::Snapshot {
        statuses: public_statuses,
    };
    let snapshot_event = Event::default()
        .json_data(&snapshot)
        .unwrap_or_else(|_| Event::default().data("{}"));

    let initial = stream::once(async move { Ok::<_, Infallible>(snapshot_event) });

    // Subscribe to broadcast channel, convert to public events
    let rx = state.sse_tx.subscribe();
    let live = BroadcastStream::new(rx).filter_map(|result| async {
        match result {
            Ok(event) => {
                let public_event = PublicSseEvent::from(&event);
                let sse_event = Event::default()
                    .json_data(&public_event)
                    .unwrap_or_else(|_| Event::default().data("{}"));
                Some(Ok(sse_event))
            }
            Err(_) => None,
        }
    });

    Sse::new(initial.chain(live)).keep_alive(KeepAlive::default())
}
