# 课程表(苹果 PWA)

一个零依赖、无构建步骤的课程表小应用,支持 **课程表 / 待办 / 便签** 三个功能,数据全部存在本地浏览器里。

在 iPhone 上打开后点「添加到主屏幕」,就能像原生 App 一样全屏使用(不需要 App Store)。

## 功能

- **课程表**:周一 ~ 周日 × 节次的网格,点格子填课程名 / 地点 / 老师 / 颜色,支持"连上 N 节"。
- **待办**:内容 + 日期 + 优先级(高/中/低),可勾选完成,可按"全部 / 今天 / 未完成"筛选。
- **便签**:标题 + 正文 + 颜色,支持置顶、搜索。
- **设置**:自定义节次与时间、显示周末、导出 / 导入 JSON 备份、清空数据。

## 本地预览

数据存在浏览器 localStorage,需要用一个本地服务器打开(双击 `index.html` 也能看界面,但 PWA 和部分功能建议走服务器)。

用 Python(你电脑已装):

```bash
cd /d/schedule-pwa
python -m http.server 8000
```

然后浏览器打开 <http://localhost:8000>。

> 也可以改用 Node:`npx serve .`

## 部署到 iPhone 使用(免费)

推荐 **GitHub Pages**:

1. 在 GitHub 新建一个**公开**仓库(比如 `schedule`)。
2. 把这个文件夹里的内容推到仓库:
   ```bash
   cd /d/schedule-pwa
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的用户名/schedule.git
   git push -u origin main
   ```
3. 仓库页 → **Settings → Pages** → Source 选 `main` 分支、根目录 → Save。
4. 稍等一两分钟,访问 `https://你的用户名.github.io/schedule/`。

**在 iPhone 上添加:**

1. 用 Safari 打开上面的网址。
2. 点底部分享按钮 →「添加到主屏幕」→ 命名 → 添加。
3. 主屏出现图标,点开就是全屏应用,断网也能用。

> 其他免费托管也可以:Vercel、Netlify、Cloudflare Pages,都是拖入文件夹即可。

## 数据说明

- 所有数据都存在**当前浏览器 / 设备的 localStorage** 里,不会上传服务器。
- 换设备或清理浏览器缓存会丢数据,所以建议定期用「设置 → 导出 JSON」备份。
- 换手机时:旧手机导出 JSON → 新手机打开应用 →「设置 → 导入 JSON」即可迁移。

## 文件结构

```
schedule-pwa/
├── index.html            页面骨架
├── css/style.css         样式
├── js/
│   ├── storage.js        数据读写 + 公共工具
│   ├── timetable.js      课程表
│   ├── todos.js          待办
│   ├── notes.js          便签
│   └── app.js            入口 + 事件 + 路由
├── manifest.webmanifest  PWA 清单
├── sw.js                 Service Worker(离线)
├── icons/                图标
└── tools/gen-icons.py    图标生成脚本(可选重跑)
```
