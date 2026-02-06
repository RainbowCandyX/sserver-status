use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub host: String,
    pub port: u16,
    /// SS encryption password
    pub password: String,
    /// SS encryption method, e.g. "aes-256-gcm", "chacha20-ietf-poly1305", "2022-blake3-aes-256-gcm"
    pub method: String,
    pub enabled: bool,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Public view of a server — hides host, port, password, method
#[derive(Debug, Clone, Serialize)]
pub struct PublicServer {
    pub id: Uuid,
    pub name: String,
    pub enabled: bool,
    pub tags: Vec<String>,
}

impl From<&Server> for PublicServer {
    fn from(s: &Server) -> Self {
        Self {
            id: s.id,
            name: s.name.clone(),
            enabled: s.enabled,
            tags: s.tags.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub server_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub tcp_check: TcpCheckResult,
    pub ss_check: Option<SsCheckResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpCheckResult {
    pub reachable: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

/// Shadowsocks protocol-level connectivity check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsCheckResult {
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub server: Server,
    pub latest_result: Option<CheckResult>,
    pub history: Vec<CheckResult>,
    pub uptime_pct: f64,
    pub avg_latency_ms: Option<f64>,
}

/// Public view of server status — uses PublicServer
#[derive(Debug, Clone, Serialize)]
pub struct PublicServerStatus {
    pub server: PublicServer,
    pub latest_result: Option<CheckResult>,
    pub history: Vec<CheckResult>,
    pub uptime_pct: f64,
    pub avg_latency_ms: Option<f64>,
}

impl From<&ServerStatus> for PublicServerStatus {
    fn from(s: &ServerStatus) -> Self {
        Self {
            server: PublicServer::from(&s.server),
            latest_result: s.latest_result.clone(),
            history: s.history.clone(),
            uptime_pct: s.uptime_pct,
            avg_latency_ms: s.avg_latency_ms,
        }
    }
}

/// Internal SSE event (broadcast between backend components, contains full data)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SseEvent {
    CheckComplete { result: CheckResult },
    ServerUpdated { server: Server },
    ServerRemoved { server_id: Uuid },
    Snapshot { statuses: Vec<ServerStatus> },
}

/// Public SSE event sent to all clients — no sensitive server info
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum PublicSseEvent {
    CheckComplete { result: CheckResult },
    ServerUpdated { server: PublicServer },
    ServerRemoved { server_id: Uuid },
    Snapshot { statuses: Vec<PublicServerStatus> },
}

impl From<&SseEvent> for PublicSseEvent {
    fn from(e: &SseEvent) -> Self {
        match e {
            SseEvent::CheckComplete { result } => PublicSseEvent::CheckComplete {
                result: result.clone(),
            },
            SseEvent::ServerUpdated { server } => PublicSseEvent::ServerUpdated {
                server: PublicServer::from(server),
            },
            SseEvent::ServerRemoved { server_id } => PublicSseEvent::ServerRemoved {
                server_id: *server_id,
            },
            SseEvent::Snapshot { statuses } => PublicSseEvent::Snapshot {
                statuses: statuses.iter().map(PublicServerStatus::from).collect(),
            },
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateServerRequest {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub password: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_enabled() -> bool {
    true
}

fn default_method() -> String {
    "aes-256-gcm".to_string()
}

impl CreateServerRequest {
    pub fn into_server(self) -> Server {
        Server {
            id: Uuid::new_v4(),
            name: self.name,
            host: self.host,
            port: self.port,
            password: self.password,
            method: self.method,
            enabled: self.enabled,
            tags: self.tags,
        }
    }
}
