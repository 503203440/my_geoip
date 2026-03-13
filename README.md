# GeoIP 服务

基于 Bun.js 的高性能 IP 地理位置查询服务，支持 MaxMind GeoIP2 数据库的自动更新。

## 🌟 功能特性

- ✅ **IP 地理位置查询** - 查询 IP 的国家、城市、经纬度等信息
- ✅ **ASN 信息查询** - 查询 IP 的自治系统编号和组织信息
- ✅ **自动更新** - 支持定时自动更新 MaxMind 数据库
- ✅ **手动更新** - 支持通过 Web 界面或 API 手动触发更新
- ✅ **美观界面** - 响应式 Web 界面，支持实时查询
- ✅ **API 接口** - RESTful API，便于集成

## 📋 项目结构

```
my_geoip/
├── index.ts                 # 主服务入口
├── handlers.js             # IP 查询处理
├── scheduler.js            # Cron 调度器
├── update-db.js            # 数据库更新脚本
├── .env.example            # 环境变量示例
├── .env                    # 环境变量配置
├── update-db.cmd           # Windows 更新脚本
├── start-server.cmd        # Windows 启动脚本
├── QUICKSTART.md           # 快速开始指南
├── UPDATE_README.md        # 详细功能说明
├── public/
│   └── index.html          # Web 界面
└── geoip_databases/        # 数据库目录（自动生成）
    ├── GeoLite2-ASN/
    │   └── GeoLite2-ASN.mmdb
    └── GeoLite2-City/
        └── GeoLite2-City.mmdb
```

## 🚀 快速开始

### 1. 获取 MaxMind 账户

1. 访问 [MaxMind 注册页面](https://www.maxmind.com/en/geolite2/signup) 注册免费账户
2. 登录后访问 [License Keys](https://www.maxmind.com/en/accounts/current/license-key) 生成 License Key
3. 记录 **Account ID** 和 **License Key**

### 2. 配置环境

复制环境变量文件：

```bash
copy .env.example .env
```

编辑 `.env` 文件，填入 MaxMind 账户信息：

```env
MAXMIND_ACCOUNT_ID=your_account_id
MAXMIND_LICENSE_KEY=your_license_key
```

### 3. 首次更新数据库

使用命令行脚本：

```bash
update-db.cmd
```

或使用 Bun 命令：

```bash
bun --env-file=.env run update-db.js
```

### 4. 启动服务

使用启动脚本：

```bash
start-server.cmd
```

或直接运行：

```bash
bun --env-file=.env run index.ts
```

服务启动后会显示：

```
🌍 GeoIP 服务已启动
   地址：http://localhost:3000/geoip
   IP 查询 API: http://localhost:3000/geoip/ip?ip=124.77.252.197
   手动更新 API: POST http://localhost:3000/geoip/update

⏰ 自动更新已启用
```

## 📖 使用指南

### Web 界面

访问 `http://localhost:3000/geoip` 使用图形界面查询 IP 信息。

### API 接口

#### IP 查询

```
GET /geoip/ip?ip={IP_ADDRESS}
```

示例：
```bash
curl "http://localhost:3000/geoip/ip?ip=8.8.8.8"
```

#### 手动更新数据库

```
POST /geoip/update
```

示例：
```bash
curl -X POST http://localhost:3000/geoip/update
```

### 自动更新配置

通过环境变量 `GEOIP_UPDATE_CRON` 配置自动更新计划：

| 频率 | Cron 表达式 | 说明 |
|------|-------------|------|
| 每天凌晨 3 点 | `0 0 3 * * *` | 默认值 |
| 每周日凌晨 2 点 | `0 0 2 * * 0` | |
| 每月 1 号凌晨 1 点 | `0 0 1 1 * *` | |
| 每 6 小时 | `0 0 */6 * * *` | |

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `MAXMIND_ACCOUNT_ID` | MaxMind 账户 ID | - | ✅ |
| `MAXMIND_LICENSE_KEY` | MaxMind License Key | - | ✅ |
| `GEOIP_DOWNLOAD_PATH` | 数据库下载路径 | `./geoip_databases` | ❌ |
| `GEOIP_EDITIONS` | 数据库类型 | `GeoLite2-ASN,GeoLite2-City` | ❌ |
| `ASN_DB_PATH` | ASN 数据库路径 | - | ✅ |
| `CITY_DB_PATH` | City 数据库路径 | - | ✅ |
| `GEOIP_UPDATE_CRON` | 更新计划 | `0 0 3 * * *` | ❌ |
| `SERVER_PORT` | 服务器端口 | `3000` | ❌ |
| `ENABLE_AUTO_UPDATE` | 启用自动更新 | `false` | ❌ |

## 🛠️ 技术栈

- **运行时**: [Bun.js](https://bun.sh/)
- **数据库**: MaxMind GeoIP2
- **前端**: 原生 JavaScript + HTML + CSS
- **调度**: 自实现 Cron 调度器

## 🔐 安全提示

1. **保护 License Key**: 不要将 `.env` 文件提交到版本控制系统
2. **定期更新**: 保持数据库更新以获得准确的地理位置信息
3. **访问控制**: 生产环境建议添加适当的访问控制

## 📞 支持

如遇问题，请参考：

- [详细功能说明](UPDATE_README.md)
- [快速开始指南](QUICKSTART.md)
- [MaxMind 官方文档](https://dev.maxmind.com/geoip/updating-databases/)

## 📄 许可证

本项目仅供学习和非商业用途使用。MaxMind GeoLite2 数据库遵循 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可证。

---

**Happy querying!** 🌍