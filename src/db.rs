use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::models::{CheckResult, SsCheckResult, TcpCheckResult};

pub fn init(path: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS check_results (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id   TEXT    NOT NULL,
            timestamp   TEXT    NOT NULL,
            tcp_reachable INTEGER NOT NULL,
            tcp_latency_ms REAL,
            tcp_error   TEXT,
            ss_success  INTEGER,
            ss_latency_ms REAL,
            ss_error    TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_results_server_time
            ON check_results(server_id, timestamp DESC);",
    )?;
    Ok(conn)
}

pub fn insert_result(conn: &Connection, result: &CheckResult) -> Result<()> {
    conn.execute(
        "INSERT INTO check_results
            (server_id, timestamp, tcp_reachable, tcp_latency_ms, tcp_error,
             ss_success, ss_latency_ms, ss_error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            result.server_id.to_string(),
            result.timestamp.to_rfc3339(),
            result.tcp_check.reachable as i32,
            result.tcp_check.latency_ms,
            result.tcp_check.error,
            result.ss_check.as_ref().map(|s| s.success as i32),
            result.ss_check.as_ref().and_then(|s| s.latency_ms),
            result.ss_check.as_ref().and_then(|s| s.error.clone()),
        ],
    )?;
    Ok(())
}

pub fn load_results_for_server(
    conn: &Connection,
    server_id: Uuid,
    limit: usize,
) -> Result<Vec<CheckResult>> {
    let mut stmt = conn.prepare(
        "SELECT server_id, timestamp, tcp_reachable, tcp_latency_ms, tcp_error,
                ss_success, ss_latency_ms, ss_error
         FROM check_results
         WHERE server_id = ?1
         ORDER BY timestamp DESC
         LIMIT ?2",
    )?;

    let rows = stmt.query_map(params![server_id.to_string(), limit as i64], |row| {
        let server_id_str: String = row.get(0)?;
        let timestamp_str: String = row.get(1)?;
        let tcp_reachable: i32 = row.get(2)?;
        let tcp_latency_ms: Option<f64> = row.get(3)?;
        let tcp_error: Option<String> = row.get(4)?;
        let ss_success: Option<i32> = row.get(5)?;
        let ss_latency_ms: Option<f64> = row.get(6)?;
        let ss_error: Option<String> = row.get(7)?;

        Ok((
            server_id_str,
            timestamp_str,
            tcp_reachable,
            tcp_latency_ms,
            tcp_error,
            ss_success,
            ss_latency_ms,
            ss_error,
        ))
    })?;

    let mut results = Vec::new();
    for row in rows {
        let (sid, ts, tcp_ok, tcp_lat, tcp_err, ss_ok, ss_lat, ss_err) = row?;
        let server_id =
            Uuid::parse_str(&sid).unwrap_or_default();
        let timestamp: DateTime<Utc> = DateTime::parse_from_rfc3339(&ts)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let ss_check = ss_ok.map(|success| SsCheckResult {
            success: success != 0,
            latency_ms: ss_lat,
            error: ss_err,
        });

        results.push(CheckResult {
            server_id,
            timestamp,
            tcp_check: TcpCheckResult {
                reachable: tcp_ok != 0,
                latency_ms: tcp_lat,
                error: tcp_err,
            },
            ss_check,
        });
    }
    Ok(results)
}

pub fn count_results_for_server(conn: &Connection, server_id: Uuid) -> Result<u64> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM check_results WHERE server_id = ?1",
        params![server_id.to_string()],
        |row| row.get(0),
    )?;
    Ok(count as u64)
}

pub fn cleanup_old(conn: &Connection, keep_days: i64) -> Result<usize> {
    let cutoff = Utc::now() - Duration::days(keep_days);
    let deleted = conn.execute(
        "DELETE FROM check_results WHERE timestamp < ?1",
        params![cutoff.to_rfc3339()],
    )?;
    Ok(deleted)
}
