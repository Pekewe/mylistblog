// ============================================================
// 发布清单总站 - 服务器入口文件
// 职责：启动 Express 服务器、配置中间件、注册路由
// ============================================================

// ---- 引入依赖 ----
var express = require('express');     // Web 框架
var session = require('express-session'); // 会话管理（用于管理员登录状态）
var cors = require('cors');           // 跨域支持
var path = require('path');           // 路径处理
var fs = require('fs');               // 文件系统
var multer = require('multer');       // 文件上传处理
var db = require('./db/database');    // 数据库操作层

var app = express();

// ---- 服务配置 ----
// 端口号可通过环境变量 PORT 覆盖，默认 3000
var PORT = process.env.PORT || 3000;
// Session 加密密钥，生产环境建议通过环境变量设置
var SESSION_SECRET = process.env.SESSION_SECRET || 'mylistblog-default-secret-key';

// ---- 图片上传配置 ----
// 所有限制集中在此对象，方便统一修改
// 如需修改：改大文件大小、增加格式类型，只需改此处
var UPLOAD_CONFIG = {
  maxFileSize: 5 * 1024 * 1024,       // 单文件最大 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],  // MIME 类型白名单
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif'],   // 扩展名白名单
  uploadDir: path.join(__dirname, '../uploads/images')     // 文件存储路径
};

// 确保上传目录存在
fs.mkdirSync(UPLOAD_CONFIG.uploadDir, { recursive: true });

// multer 存储配置：文件保存到磁盘
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_CONFIG.uploadDir);
  },
  // 文件名规则：时间戳-6位随机字符.扩展名
  // 目的：防止文件名冲突、避免暴露原始文件名
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    var name = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, name);
  }
});

// 文件类型过滤器：只允许白名单中的格式
var fileFilter = function (req, file, cb) {
  var ext = path.extname(file.originalname).toLowerCase();
  if (UPLOAD_CONFIG.allowedExtensions.indexOf(ext) !== -1) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件格式，仅支持 JPG、PNG、GIF'));
  }
};

// 初始化 multer 实例
var upload = multer({
  storage: storage,
  limits: { fileSize: UPLOAD_CONFIG.maxFileSize },
  fileFilter: fileFilter
});

// ---- Express 中间件配置 ----
app.use(cors());                      // 允许跨域请求
app.use(express.json());              // 解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 解析表单请求体

// Session 配置
// 会话通过 Cookie 维持，有效期 24 小时
app.use(session({
  name: 'mylistblog.sid',             // Cookie 名称
  secret: SESSION_SECRET,             // 加密密钥
  resave: false,                      // 不强制保存未修改的 session
  saveUninitialized: false,           // 不保存未初始化的 session
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,     // 24 小时后过期
    httpOnly: true,                   // 禁止客户端 JS 读取 Cookie（防 XSS）
    sameSite: 'lax'                   // 限制跨站请求携带 Cookie（防 CSRF）
  }
}));

// 静态文件托管
// 根目录（项目根目录）→ 直接访问 index.html 等
// /uploads → 访问上传的图片
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ---- 路由 ----

var requireAdmin = require('./middleware/auth').requireAdmin;

// 图片上传接口（需管理员登录）
app.post('/api/upload/image', requireAdmin, function (req, res) {
  // upload.single('image') 是 multer 中间件，处理单文件上传
  // 表单字段名必须为 'image'
  upload.single('image')(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, error: { code: 'FILE_TOO_LARGE', message: '文件大小不能超过5MB' } });
      }
      return res.status(400).json({ ok: false, error: { code: 'UPLOAD_ERROR', message: err.message } });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: { code: 'NO_FILE', message: '请选择要上传的图片' } });
    }
    // 返回可公开访问的图片 URL
    var url = '/uploads/images/' + req.file.filename;
    res.json({ ok: true, data: { url: url } });
  });
});

// 注册各功能模块的路由
require('./routes/lists')(app);       // 清单相关 API
require('./routes/messages')(app);    // 留言相关 API
require('./routes/categories')(app);  // 分类相关 API
require('./routes/auth')(app);        // 认证相关 API
require('./routes/publishers')(app);  // 发布人管理 API
require('./routes/settings')(app);    // 站点设置 API

// ---- 全局错误处理 ----
// 放在所有路由之后，捕获未被处理的错误
app.use(function (err, req, res, next) {
  // JSON 解析失败（如请求体格式错误）
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_JSON', message: '请求数据格式错误' }
    });
  }
  // multer 文件上传错误
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      ok: false,
      error: { code: 'UPLOAD_ERROR', message: '文件上传出错' }
    });
  }
  // 未知错误
  console.error('Server error:', err);
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' }
  });
});

// ---- 启动服务器 ----
// 先初始化数据库（建表 + 种子数据），再监听端口
db.init().then(function () {
  app.listen(PORT, function () {
    console.log('服务器已启动: http://localhost:' + PORT);
    console.log('访问 http://localhost:' + PORT + '/index.html 查看前台');
    console.log('访问 http://localhost:' + PORT + '/admin.html 管理后台');
  });
}).catch(function (err) {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
