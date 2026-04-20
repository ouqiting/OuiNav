# Cloudflare Pages 轻量导航起始页

这是一个纯静态前端 + Cloudflare Pages Functions 的轻量导航页模板。

## 功能

- 首屏密码验证
- `记住密码` 选项
- 毛玻璃风格导航卡片
- 新建链接弹窗
- 支持上传图标
- 链接数据持久化到 KV

## 为什么要用 KV

如果你希望在页面里新增链接后，所有设备和后续访问都能看到这些改动，就需要额外存储。

这个项目使用一个 KV Namespace 保存全部导航项，优点是：

- 配置简单
- 成本低
- 很适合轻量导航页

当前方案会把图标压缩后转成小尺寸 `data URL` 一起存进 KV，不需要额外配置 R2。
如果后面图标数量很多，或者你想上传更大的图片，再升级到 R2 更合适。

## 需要配置的变量

在 Cloudflare Pages 项目后台：

`Settings > Variables and Secrets`

添加下面这些值：

- Secret: `NAV_PASSWORD_HASH`
- Secret: `SESSION_SECRET`
- Variable: `DEFAULT_LINKS_JSON` 可选

另外在：

`Settings > Bindings`

添加：

- KV Namespace 绑定名：`NAV_LINKS_KV`

## 密码推荐做法

不要保存明文密码，推荐设置 `NAV_PASSWORD_HASH`。

PowerShell 生成 SHA-256 十六进制哈希：

```powershell
$text = "你的密码"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
($hash | ForEach-Object { $_.ToString("x2") }) -join ""
```

把输出结果填到 `NAV_PASSWORD_HASH`。

`SESSION_SECRET` 建议使用一段随机长字符串，例如 32 位以上。

## 默认导航项

如果你想在第一次部署时就显示一批链接，可以设置 `DEFAULT_LINKS_JSON`。

示例：

```json
[
  {
    "id": "panel",
    "name": "VPS 面板",
    "description": "服务器运维与状态查看",
    "url": "https://panel.example.com",
    "icon": ""
  },
  {
    "id": "grafana",
    "name": "Grafana",
    "description": "监控大盘与资源趋势",
    "url": "https://grafana.example.com",
    "icon": ""
  }
]
```

如果 KV 里还没有数据，页面会优先读取这个默认值。
一旦你通过页面新增了链接，KV 中的数据会成为主数据源。

## 本地开发

1. 安装依赖：

```powershell
npm install
```

2. 启动本地开发：

```powershell
npx wrangler pages dev public --kv NAV_LINKS_KV
```

本地开发时仍然需要通过 `.dev.vars` 或 Wrangler 的本地环境变量方式提供：

- `NAV_PASSWORD_HASH`
- `SESSION_SECRET`
- `DEFAULT_LINKS_JSON` 可选

## 部署到 Cloudflare Pages

1. 把仓库连接到 Cloudflare Pages
2. Build command 留空
3. Build output directory 填 `public`
4. 在 Pages 后台添加上面的 Variables / Secrets / KV Binding
5. 重新部署

## 文件结构

```text
public/
  index.html
  styles.css
  app.js
  _headers
functions/
  api/
    auth.js
    session.js
    links.js
  utils/
    auth.js
    response.js
    storage.js
```
