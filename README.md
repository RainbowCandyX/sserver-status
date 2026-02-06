# sserver-status

Shadowsocks 服务器连通性监控面板。单个二进制文件，内嵌 Web 前端，支持实时状态推送。

## 功能

- **TCP 端口检测** — 测试服务器端口是否可达，记录延迟
- **Shadowsocks 协议检测** — 通过实际加密隧道验证 SS 服务是否正常工作
- **实时仪表盘** — SSE 推送，无需刷新即可看到最新状态
- **服务器管理** — Web UI 添加、编辑、删除服务器，修改即时生效
- **登录鉴权** — 未登录用户只能看到服务器名称和状态，敏感信息（IP、端口、密码、加密方式）仅登录后可见
- **定时检测** — 可在设置中调整检测间隔，无需重启
- **数据持久化** — 检测结果存储在 SQLite，保留最近 7 天数据，重启不丢失
- **深浅主题** — 支持深色/浅色模式切换，跟随系统偏好
- **单文件部署** — 编译产物为单个可执行文件，前端资源内嵌

## 支持的加密方式

| 类别 | 方式 |
|------|------|
| AEAD | aes-128-gcm, aes-256-gcm, chacha20-ietf-poly1305 |
| AEAD 2022 | 2022-blake3-aes-128-gcm, 2022-blake3-aes-256-gcm, 2022-blake3-chacha20-poly1305 |
| Stream (旧) | aes-128-cfb, aes-256-cfb, chacha20-ietf, rc4-md5 |

## 快速开始

### 编译

```bash
cargo build --release
```

产物位于 `target/release/sserver-status`。

### 配置

复制示例配置并修改：

```bash
cp config.example.yaml config.yaml
```

```yaml
listen: "0.0.0.0:3000"

auth:
  username: "admin"
  password: "change-me"

check_interval_secs: 60
tcp_timeout_secs: 5
ss_timeout_secs: 10
test_target: "www.gstatic.com"

servers:
  - name: "Tokyo-01"
    host: "103.45.67.89"
    port: 8388
    password: "your-password"
    method: "aes-256-gcm"
    enabled: true
    tags: ["jp", "premium"]
```

### 运行

```bash
./sserver-status --config config.yaml
```

打开浏览器访问 `http://localhost:3000`。

### 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-c, --config` | `config.yaml` | 配置文件路径 |
| `-l, --listen` | 配置文件中的值 | 监听地址（覆盖配置文件） |
| `-d, --db` | `sserver-status.db` | SQLite 数据库文件路径 |

## 使用说明

### 登录

点击右上角 **Login** 按钮，输入配置文件中设置的用户名和密码。登录后可以：

- 查看服务器的 IP、端口、加密方式等详细信息
- 添加、编辑、删除服务器
- 手动触发单台服务器检测
- 修改检测间隔等设置

### 状态指示

| 状态 | 含义 |
|------|------|
| 绿色 | TCP 可达且 SS 协议正常 |
| 黄色 | TCP 可达但 SS 协议异常 |
| 红色 | TCP 不可达 |
| 灰色 | 服务器已禁用 |

### 通过 Web UI 管理服务器

登录后点击 **+ Add Server** 添加服务器，填写名称、地址、端口、密码和加密方式。新添加的服务器会立即执行一次检测。

所有通过 Web UI 的修改会自动保存到配置文件。

## API

所有写操作需要 `Authorization: Bearer <token>` 头。

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 否 | 登录，返回 token |
| POST | `/api/auth/logout` | 是 | 注销 |
| GET | `/api/auth/status` | - | 检查 token 是否有效 |
| GET | `/api/servers` | 可选 | 服务器列表（未登录返回脱敏数据） |
| POST | `/api/servers` | 是 | 添加服务器 |
| PUT | `/api/servers/{id}` | 是 | 更新服务器 |
| DELETE | `/api/servers/{id}` | 是 | 删除服务器 |
| POST | `/api/servers/{id}/check` | 否 | 立即检测 |
| GET | `/api/results/{id}` | 否 | 检测历史 |
| GET | `/api/settings` | 是 | 获取设置 |
| PUT | `/api/settings` | 是 | 更新设置 |
| GET | `/api/events` | 否 | SSE 实时事件流 |

## 技术栈

- **后端**: Rust + Axum + Tokio
- **前端**: 原生 HTML/CSS/JS（无框架，无构建步骤）
- **数据库**: SQLite（rusqlite bundled，无需系统安装）
- **协议检测**: shadowsocks crate
- **静态资源**: rust-embed 内嵌到二进制文件

## License

MIT
