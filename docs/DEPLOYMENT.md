# 决战动漫之巅 · 部署文档

本文档说明项目本地运行、VPS 生产部署、证书续签、更新发布、验证和回滚流程。

## 1. 项目结构

```text
.
├── index.html                  # 应用入口
├── css/style.css               # 页面样式
├── js/                         # 前端逻辑、赛制、分享图
│   ├── api.js                  # Bangumi API 数据层
│   ├── app.js                  # 主应用
│   ├── tournament.js           # 赛制逻辑
│   ├── share.js                # 分享图生成
│   ├── util.js                 # 工具函数
│   └── qrcode.js               # QR 码库
├── fonts/                      # 自托管字体
├── server.mjs                  # 本地静态文件服务器
├── deploy/nginx/               # 生产 nginx 配置模板
└── docs/DEPLOYMENT.md          # 部署说明
```

生产环境是纯静态站点，不需要 Node.js 常驻服务。动漫搜索、封面和信息由浏览器在运行时请求公开 Bangumi API（`api.bgm.tv`）。

## 2. 本地运行

要求：Node.js 18 或更高版本。

```bash
cd /path/to/anime-cup
node server.mjs
```

默认访问地址：

```text
http://127.0.0.1:4174/
```

如需换端口：

```bash
PORT=8088 node server.mjs
```

## 3. 生产部署目标

假设你的域名是 `anime.YOUR_DOMAIN`，请替换为实际域名。

```text
https://anime.YOUR_DOMAIN/
```

生产目录：

```text
/var/www/anime.YOUR_DOMAIN
```

nginx 配置：

```text
/etc/nginx/sites-available/anime.YOUR_DOMAIN
/etc/nginx/sites-enabled/anime.YOUR_DOMAIN -> /etc/nginx/sites-available/anime.YOUR_DOMAIN
```

证书目录：

```text
/root/cert/anime.YOUR_DOMAIN/fullchain.pem
/root/cert/anime.YOUR_DOMAIN/privkey.pem
```

## 4. 首次部署流程

### 4.1 准备目录

```bash
install -d -m 0755 /var/www/anime.YOUR_DOMAIN
install -d -m 0755 /var/www/acme/.well-known/acme-challenge
```

### 4.2 上传静态资源

从本机执行（替换 `<VPS_IP>` 为你的服务器 IP）：

```bash
scp -r index.html css js fonts \
  root@<VPS_IP>:/var/www/anime.YOUR_DOMAIN/
```

### 4.3 启用证书签发临时配置

先修改 `deploy/nginx/anime.bootstrap.conf` 中的 `anime.YOUR_DOMAIN` 为你实际的域名，然后上传：

```bash
scp deploy/nginx/anime.bootstrap.conf \
  root@<VPS_IP>:/etc/nginx/sites-available/anime.YOUR_DOMAIN.bootstrap.conf
```

启用临时配置：

```bash
ln -sfn /etc/nginx/sites-available/anime.YOUR_DOMAIN.bootstrap.conf \
  /etc/nginx/sites-enabled/anime.YOUR_DOMAIN
nginx -t
systemctl reload nginx
```

### 4.4 签发证书

服务器使用 acme.sh：

```bash
/root/.acme.sh/acme.sh --issue \
  -d anime.YOUR_DOMAIN \
  -w /var/www/acme \
  --keylength ec-256 \
  --server letsencrypt
```

安装证书并设置续签后重载 nginx：

```bash
install -d -m 0700 /root/cert/anime.YOUR_DOMAIN
/root/.acme.sh/acme.sh --install-cert \
  -d anime.YOUR_DOMAIN \
  --ecc \
  --key-file /root/cert/anime.YOUR_DOMAIN/privkey.pem \
  --fullchain-file /root/cert/anime.YOUR_DOMAIN/fullchain.pem \
  --reloadcmd "systemctl reload nginx"
```

### 4.5 启用最终 nginx 配置

修改 `deploy/nginx/anime.conf` 中的 `anime.YOUR_DOMAIN` 为你实际的域名，然后上传：

```bash
scp deploy/nginx/anime.conf \
  root@<VPS_IP>:/etc/nginx/sites-available/anime.YOUR_DOMAIN
```

切换最终配置：

```bash
ln -sfn /etc/nginx/sites-available/anime.YOUR_DOMAIN \
  /etc/nginx/sites-enabled/anime.YOUR_DOMAIN
nginx -t
systemctl reload nginx
```

## 5. 日常更新发布

修改前端资源后，建议同步更新 `index.html` 中的 `?v=anime-*` 版本号，再上传静态资源：

```bash
scp -r index.html css js fonts \
  root@<VPS_IP>:/var/www/anime.YOUR_DOMAIN/
```

静态资源更新通常不需要 reload nginx；只有 nginx 配置变更时才执行：

```bash
nginx -t && systemctl reload nginx
```

## 6. 证书续签

服务器已有 acme.sh 定时任务：

```bash
crontab -l | grep acme.sh
```

检查证书续签信息：

```bash
/root/.acme.sh/acme.sh --info -d anime.YOUR_DOMAIN --ecc
```

关键项：

```text
Le_Domain=anime.YOUR_DOMAIN
Le_ReloadCmd=systemctl reload nginx
```

只要 acme.sh cron 正常存在，证书会自动续签，并在续签后自动 reload nginx。

## 7. 验证清单

### 7.1 nginx 配置

```bash
nginx -t
```

### 7.2 HTTP/HTTPS

```bash
curl -I http://anime.YOUR_DOMAIN/
curl -I https://anime.YOUR_DOMAIN/
```

预期：
- HTTP 返回 `301` 并跳转到 HTTPS。
- HTTPS 返回 `200`。

### 7.3 静态资源

```bash
for path in / css/style.css js/app.js js/share.js fonts/anton-400.woff2; do
  curl -ksS -o /dev/null -w "%{http_code} %{url_effective}\n" "https://anime.YOUR_DOMAIN/$path"
done
```

预期全部返回 `200`。

## 8. 回滚

### 8.1 仅回滚页面资源

把上一版文件重新上传到生产目录：

```bash
scp -r index.html css js fonts \
  root@<VPS_IP>:/var/www/anime.YOUR_DOMAIN/
```

### 8.2 下线整个站点

```bash
rm -f /etc/nginx/sites-enabled/anime.YOUR_DOMAIN
rm -f /etc/nginx/sites-available/anime.YOUR_DOMAIN
rm -f /etc/nginx/sites-available/anime.YOUR_DOMAIN.bootstrap.conf
rm -rf /var/www/anime.YOUR_DOMAIN
rm -rf /root/cert/anime.YOUR_DOMAIN
nginx -t && systemctl reload nginx
```

如需同时清理 acme.sh 记录：

```bash
/root/.acme.sh/acme.sh --remove -d anime.YOUR_DOMAIN --ecc
```

## 9. 注意事项

- 不要把 SSH 密码、token、私钥提交到仓库。
- 生产环境不运行 `server.mjs`，该文件仅用于本地预览。
- 动漫数据使用 Bangumi API，浏览器直连 `api.bgm.tv`，无需服务端代理。
- 首次访问可能较慢（Bangumi API 需跨域请求），建议使用 HTTPS 避免混合内容问题。
- nginx 配置只新增独立站点，避免影响其他项目。
