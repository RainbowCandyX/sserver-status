use std::net::SocketAddr;
use std::time::{Duration, Instant};

use chrono::Utc;
use shadowsocks::config::{ServerConfig as SsServerConfig, ServerType};
use shadowsocks::context::Context;
use shadowsocks::crypto::CipherKind;
use shadowsocks::relay::tcprelay::proxy_stream::ProxyClientStream;
use shadowsocks::ServerAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::models::{CheckResult, Server, SsCheckResult, TcpCheckResult};

pub async fn tcp_check(host: &str, port: u16, timeout: Duration) -> TcpCheckResult {
    let start = Instant::now();
    let addr = format!("{}:{}", host, port);

    match tokio::time::timeout(timeout, TcpStream::connect(&addr)).await {
        Ok(Ok(_stream)) => TcpCheckResult {
            reachable: true,
            latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0),
            error: None,
        },
        Ok(Err(e)) => TcpCheckResult {
            reachable: false,
            latency_ms: None,
            error: Some(e.to_string()),
        },
        Err(_) => TcpCheckResult {
            reachable: false,
            latency_ms: None,
            error: Some("Connection timed out".into()),
        },
    }
}

/// Perform a real Shadowsocks protocol connectivity check.
/// Connects to the SS server with the given password/method,
/// then tries to relay an HTTP request to test_url through it.
pub async fn ss_protocol_check(
    host: &str,
    port: u16,
    password: &str,
    method_str: &str,
    test_target: &str,
    timeout: Duration,
) -> SsCheckResult {
    let start = Instant::now();

    let result = tokio::time::timeout(timeout, async {
        // Parse cipher method
        let method: CipherKind = method_str
            .parse()
            .map_err(|_| anyhow::anyhow!("Unknown cipher method: {}", method_str))?;

        // Build SS server config
        let server_addr = format!("{}:{}", host, port);
        let addr: SocketAddr = tokio::net::lookup_host(&server_addr)
            .await?
            .next()
            .ok_or_else(|| anyhow::anyhow!("DNS resolution failed for {}", server_addr))?;

        let ss_config = SsServerConfig::new(
            ServerAddr::SocketAddr(addr),
            password,
            method,
        )?;

        let context = Context::new_shared(ServerType::Local);

        // Connect through the SS server to a test target (e.g. www.gstatic.com:80)
        // This validates the full SS handshake + encryption works
        let target_addr = shadowsocks::relay::Address::DomainNameAddress(
            test_target.to_string(),
            80,
        );

        let mut stream = ProxyClientStream::connect(
            context,
            &ss_config,
            target_addr,
        )
        .await?;

        // Send a minimal HTTP request through the tunnel
        let http_req = format!(
            "GET /generate_204 HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
            test_target
        );
        stream.write_all(http_req.as_bytes()).await?;

        // Read the response (just need to get something back)
        let mut buf = [0u8; 512];
        let n = stream.read(&mut buf).await?;
        if n == 0 {
            return Err(anyhow::anyhow!("Empty response from test target"));
        }

        // Check we got a valid HTTP response
        let response = String::from_utf8_lossy(&buf[..n]);
        if !response.starts_with("HTTP/") {
            return Err(anyhow::anyhow!("Invalid HTTP response"));
        }

        Ok::<_, anyhow::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => SsCheckResult {
            success: true,
            latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0),
            error: None,
        },
        Ok(Err(e)) => SsCheckResult {
            success: false,
            latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0),
            error: Some(e.to_string()),
        },
        Err(_) => SsCheckResult {
            success: false,
            latency_ms: None,
            error: Some("SS protocol check timed out".into()),
        },
    }
}

pub async fn check_server(
    server: &Server,
    tcp_timeout: Duration,
    ss_timeout: Duration,
    test_target: &str,
) -> CheckResult {
    let tcp = tcp_check(&server.host, server.port, tcp_timeout).await;

    // Only do SS protocol check if TCP is reachable
    let ss = if tcp.reachable {
        Some(
            ss_protocol_check(
                &server.host,
                server.port,
                &server.password,
                &server.method,
                test_target,
                ss_timeout,
            )
            .await,
        )
    } else {
        Some(SsCheckResult {
            success: false,
            latency_ms: None,
            error: Some("Skipped: TCP unreachable".into()),
        })
    };

    CheckResult {
        server_id: server.id,
        timestamp: Utc::now(),
        tcp_check: tcp,
        ss_check: ss,
    }
}
