use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_listen")]
    pub listen: String,
    #[serde(default)]
    pub auth: AuthConfig,
    #[serde(default = "default_check_interval")]
    pub check_interval_secs: u64,
    #[serde(default = "default_tcp_timeout")]
    pub tcp_timeout_secs: u64,
    #[serde(default = "default_ss_timeout")]
    pub ss_timeout_secs: u64,
    #[serde(default = "default_test_target")]
    pub test_target: String,
    #[serde(default)]
    pub servers: Vec<ServerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    #[serde(default = "default_username")]
    pub username: String,
    #[serde(default = "default_password")]
    pub password: String,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            username: default_username(),
            password: default_password(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
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

fn default_listen() -> String {
    "0.0.0.0:3000".to_string()
}
fn default_username() -> String {
    "admin".to_string()
}
fn default_password() -> String {
    "admin".to_string()
}
fn default_check_interval() -> u64 {
    60
}
fn default_tcp_timeout() -> u64 {
    5
}
fn default_ss_timeout() -> u64 {
    10
}
fn default_test_target() -> String {
    "www.gstatic.com".to_string()
}
fn default_method() -> String {
    "aes-256-gcm".to_string()
}
fn default_enabled() -> bool {
    true
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            listen: default_listen(),
            auth: AuthConfig::default(),
            check_interval_secs: default_check_interval(),
            tcp_timeout_secs: default_tcp_timeout(),
            ss_timeout_secs: default_ss_timeout(),
            test_target: default_test_target(),
            servers: Vec::new(),
        }
    }
}

pub fn load(path: &str) -> Result<AppConfig> {
    if !Path::new(path).exists() {
        tracing::warn!("Config file {} not found, using defaults", path);
        return Ok(AppConfig::default());
    }
    let file = std::fs::File::open(path)?;
    let config: AppConfig = serde_yaml_ng::from_reader(file)?;
    Ok(config)
}

pub async fn persist(state: &AppState) -> Result<()> {
    let Some(ref path) = state.config_path else {
        return Ok(());
    };

    let servers = state.servers.read().await;
    let server_configs: Vec<ServerConfig> = servers
        .values()
        .map(|s| ServerConfig {
            id: s.id,
            name: s.name.clone(),
            host: s.host.clone(),
            port: s.port,
            password: s.password.clone(),
            method: s.method.clone(),
            enabled: s.enabled,
            tags: s.tags.clone(),
        })
        .collect();

    let check_interval_secs = *state.check_interval_secs.read().await;

    let config = AppConfig {
        listen: state.listen.clone(),
        auth: state.auth.clone(),
        check_interval_secs,
        tcp_timeout_secs: state.tcp_timeout_secs,
        ss_timeout_secs: state.ss_timeout_secs,
        test_target: state.test_target.clone(),
        servers: server_configs,
    };

    let file = std::fs::File::create(path)?;
    serde_yaml_ng::to_writer(file, &config)?;
    Ok(())
}
