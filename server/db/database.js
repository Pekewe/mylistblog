// ============================================================
// 发布清单总站 - 数据库操作层
// 职责：封装所有 SQLite 数据库操作，其他模块只需调用方法
// 技术栈：sql.js（纯 JS 版 SQLite，无需编译）
// 安全：所有 SQL 使用参数化查询（? 占位符）防止 SQL 注入
// ============================================================

// ---- 引入依赖 ----
const initSqlJs = require('sql.js');    // 纯 JS 版 SQLite 引擎
const fs = require('fs');               // 文件系统（读写 .db 文件）
const path = require('path');           // 路径处理
const bcrypt = require('bcryptjs');     // 密码哈希

// ---- 数据库连接状态 ----
var db = null;  // 数据库实例（初始化后赋值）
// 数据库文件存储路径：项目根目录下的 data/mylistblog.db
var DB_PATH = path.join(__dirname, '../../data/mylistblog.db');

// ---- 内部工具函数 ----
// sql.js 在内存中操作数据库，修改后需调用 export() 写回文件
function saveToFile() {
  var data = db.export();
  var buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// 执行 SELECT 并返回第一行第一个值（用于 COUNT、last_insert_rowid 等）
function getFirstValue(sql, params) {
  var stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  var val = null;
  if (stmt.step()) {
    val = stmt.get()[0];
  }
  stmt.free();
  return val;
}

// 执行 INSERT/UPDATE/DELETE（无返回值）
function runSql(sql, params) {
  if (params) {
    var stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
  } else {
    db.run(sql);
  }
}

// 执行 SELECT 并返回所有结果（数组格式，字段名为 key）
function queryObjects(sql, params) {
  var stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  var rows = [];
  while (stmt.step()) {
    var row = stmt.getAsObject();
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// ---- 导出模块方法 ----
module.exports = {
  // ==========================================================
  // 初始化：加载数据库文件 → 建表 → 填充种子数据
  // ==========================================================
  init: async function () {
    var SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      // 已有数据库文件 → 加载
      var buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      // 首次启动 → 创建新数据库
      db = new SQL.Database();
    }
    this.createTables();
    this.seedIfNeeded();
  },

  // ==========================================================
  // 建表：定义所有数据表结构
  // 注意：sql.js 不支持 ALTER TABLE，字段设计需一次到位
  // ==========================================================
  createTables: function () {
    // ---- 清单主表 ----
    // status: published(已发布) / draft(草稿) / pending(待审核)
    db.run("CREATE TABLE IF NOT EXISTS lists (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "title TEXT NOT NULL," +
      "product_code TEXT NOT NULL DEFAULT ''," +     // 商品編號
      "category TEXT NOT NULL DEFAULT ''," +          // 分类
      "author TEXT NOT NULL DEFAULT ''," +            // 作者（发布人显示名称）
      "image TEXT NOT NULL DEFAULT ''," +             // 封面图片路径/URL
      "status TEXT NOT NULL DEFAULT 'published'" +
      "CHECK(status IN ('published','draft','pending'))," +
      "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))," +
      "updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))" +
      ")");
    // ---- 清单条目子表（一对多） ----
    db.run("CREATE TABLE IF NOT EXISTS list_items (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "list_id INTEGER NOT NULL," +
      "sort_order INTEGER NOT NULL DEFAULT 0," +     // 排序序号
      "content TEXT NOT NULL," +
      "FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE" +
      ")");
    // ---- 清单链接子表（一对多） ----
    db.run("CREATE TABLE IF NOT EXISTS list_links (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "list_id INTEGER NOT NULL," +
      "title TEXT NOT NULL," +                        // 链接显示名称
      "url TEXT NOT NULL," +                          // 链接URL
      "FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE" +
      ")");
    // ---- 分类表 ----
    db.run("CREATE TABLE IF NOT EXISTS categories (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "name TEXT NOT NULL UNIQUE," +                  // 分类名称（唯一）
      "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))" +
      ")");
    // ---- 发布人账号表 ----
    // 发布人由管理员手动创建，通过账号密码验证后发布清单
    // status: active(启用) / disabled(禁用)
    db.run("CREATE TABLE IF NOT EXISTS publishers (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "username TEXT NOT NULL UNIQUE," +              // 登录用户名
      "password TEXT NOT NULL," +                     // bcrypt 哈希
      "display_name TEXT NOT NULL DEFAULT ''," +      // 显示名称（清单作者名）
      "status TEXT NOT NULL DEFAULT 'active'" +
      "CHECK(status IN ('active','disabled'))," +
      "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))," +
      "updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))" +
      ")");
    // ---- 留言表 ----
    // status: pending(待审核) / approved(已通过) / rejected(已拒绝)
    db.run("CREATE TABLE IF NOT EXISTS messages (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "name TEXT NOT NULL," +                         // 留言者昵称
      "content TEXT NOT NULL," +                      // 留言内容
      "status TEXT NOT NULL DEFAULT 'pending'" +
      "CHECK(status IN ('pending','approved','rejected'))," +
      "reply_content TEXT NOT NULL DEFAULT ''," +     // 管理员回复内容
      "reply_at TEXT," +                               // 回复时间
      "reply_by TEXT NOT NULL DEFAULT ''," +           // 回复人（管理员用户名）
      "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))" +
      ")");
    // ---- 站点设置表（键值对）----
    db.run("CREATE TABLE IF NOT EXISTS settings (" +
      "key TEXT PRIMARY KEY," +                       // 设置项名称
      "value TEXT NOT NULL" +                          // 设置项值
      ")");
    // ---- 管理员账号表 ----
    db.run("CREATE TABLE IF NOT EXISTS admin_users (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "username TEXT NOT NULL UNIQUE," +
      "password TEXT NOT NULL," +                     // bcrypt 哈希
      "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))" +
      ")");
    // ---- 索引：加速常用查询 ----
    db.run("CREATE INDEX IF NOT EXISTS idx_lists_status ON lists(status)");
    db.run("CREATE INDEX IF NOT EXISTS idx_lists_category ON lists(category)");
    db.run("CREATE INDEX IF NOT EXISTS idx_lists_created ON lists(created_at)");
    db.run("CREATE INDEX IF NOT EXISTS idx_items_list ON list_items(list_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_links_list ON list_links(list_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)");
    db.run("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)");
    saveToFile();
  },

  // ==========================================================
  // 种子数据：首次启动时填充示例数据
  // 判断依据：admin_users 表中是否有记录
  // 包含：管理员账号、默认设置、5个分类、3条清单、2条留言、1个发布人
  // ==========================================================
  seedIfNeeded: function () {
    var count = getFirstValue("SELECT COUNT(*) FROM admin_users");
    if (count > 0) return; // 已有数据，跳过

    // 管理员账号：admin / admin123
    var hash = bcrypt.hashSync('admin123', 10);
    runSql("INSERT INTO admin_users (username, password) VALUES (?, ?)", ['admin', hash]);

    // 默认站点设置
    runSql("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", ['site_name', '发布清单总站']);
    runSql("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", ['site_intro', '回忆驱动的站点']);

    // 默认分类
    runSql("INSERT OR IGNORE INTO categories (name) VALUES (?)", ['音樂']);
    runSql("INSERT OR IGNORE INTO categories (name) VALUES (?)", ['同人音樂']);
    runSql("INSERT OR IGNORE INTO categories (name) VALUES (?)", ['廣播劇']);
    runSql("INSERT OR IGNORE INTO categories (name) VALUES (?)", ['影片']);
    runSql("INSERT OR IGNORE INTO categories (name) VALUES (?)", ['修正']);

    // 示例清单1：音樂
    runSql("INSERT INTO lists (title, product_code, category, author, status, created_at) VALUES (?,?,?,?,?,?)",
      ['TVアニメ「半分の月がのぼる空」OP&ED 「青い幸福」／nobuko', '', '音樂', '管理员', 'published', '2006-02-16 19:22:31']);
    var listId = getFirstValue("SELECT last_insert_rowid()");
    runSql("INSERT INTO list_items (list_id, sort_order, content) VALUES (?,?,?)", [listId, 1, '半分の月がのぼる空OP']);
    runSql("INSERT INTO list_items (list_id, sort_order, content) VALUES (?,?,?)", [listId, 2, '半分の月がのぼる空ED']);
    runSql("INSERT INTO list_links (list_id, title, url) VALUES (?,?,?)", [listId, '相关网站', 'http://www.amazon.co.jp/exec/obidos/ASIN/B000DZJLBG/503-0911234-8979161']);
    runSql("INSERT INTO list_links (list_id, title, url) VALUES (?,?,?)", [listId, '流量资讯', 'http://www.amazon.co.jp/exec/obidos/ASIN/B000DZJLBG/503-0911234-8979161']);

    // 示例留言（已审核）
    runSql("INSERT INTO messages (name, content, status, created_at) VALUES (?,?,?,?)",
      ['游客', '希望能看到舊檔', 'approved', '2006-03-10 08:45:00']);
    runSql("INSERT INTO messages (name, content, status, created_at) VALUES (?,?,?,?)",
      ['路人A', '可以考虑单开一个OST分组', 'approved', '2006-03-12 16:20:00']);

    // 默认发布人：publisher1 / pub123
    var pubHash = bcrypt.hashSync('pub123', 10);
    runSql("INSERT INTO publishers (username, password, display_name, status) VALUES (?,?,?,?)",
      ['publisher1', pubHash, '发布', 'active']);

    saveToFile();
  },

  // ==========================================================
  // 清单相关方法
  // ==========================================================

  // 前台：分页获取已发布的清单（含 items 和 links 子数据）
  getPublishedLists: function (page, size) {
    var offset = (page - 1) * size;
    var total = getFirstValue("SELECT COUNT(*) FROM lists WHERE status='published'");
    var rows = queryObjects("SELECT * FROM lists WHERE status='published' ORDER BY created_at DESC LIMIT ? OFFSET ?", [size, offset]);
    // 每条清单补全 items 和 links（用于前台展示）
    for (var i = 0; i < rows.length; i++) {
      rows[i].items = queryObjects("SELECT content FROM list_items WHERE list_id = ? ORDER BY sort_order", [rows[i].id]).map(function (r) { return r.content; });
      rows[i].links = queryObjects("SELECT title, url FROM list_links WHERE list_id = ?", [rows[i].id]);
    }
    return { rows: rows, total: total, page: page, size: size, totalPages: Math.ceil(total / size) || 1 };
  },

  // 根据 ID 获取单条清单详情（含 items 和 links）
  getListById: function (id) {
    var rows = queryObjects("SELECT * FROM lists WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    var list = rows[0];
    list.items = queryObjects("SELECT content FROM list_items WHERE list_id = ? ORDER BY sort_order", [id]).map(function (r) { return r.content; });
    list.links = queryObjects("SELECT title, url FROM list_links WHERE list_id = ?", [id]);
    return list;
  },

  // 前台：按关键词搜索已发布的清单（标题、分类、作者）
  searchLists: function (keyword, page, size) {
    var offset = (page - 1) * size;
    var kw = '%' + keyword + '%';
    var total = getFirstValue("SELECT COUNT(*) FROM lists WHERE status='published' AND (title LIKE ? OR category LIKE ? OR author LIKE ?)", [kw, kw, kw]);
    var rows = queryObjects("SELECT * FROM lists WHERE status='published' AND (title LIKE ? OR category LIKE ? OR author LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?", [kw, kw, kw, size, offset]);
    for (var i = 0; i < rows.length; i++) {
      rows[i].items = queryObjects("SELECT content FROM list_items WHERE list_id = ? ORDER BY sort_order", [rows[i].id]).map(function (r) { return r.content; });
      rows[i].links = queryObjects("SELECT title, url FROM list_links WHERE list_id = ?", [rows[i].id]);
    }
    return { rows: rows, total: total, page: page, size: size, totalPages: Math.ceil(total / size) || 1 };
  },

  // 创建新清单（含 items 和 links）
  createList: function (data) {
    var status = data.status || 'published';
    runSql("INSERT INTO lists (title, product_code, category, author, image, status) VALUES (?,?,?,?,?,?)",
      [data.title, data.product_code || '', data.category, data.author, data.image || '', status]);
    var listId = getFirstValue("SELECT last_insert_rowid()");
    if (data.items) {
      for (var i = 0; i < data.items.length; i++) {
        runSql("INSERT INTO list_items (list_id, sort_order, content) VALUES (?,?,?)", [listId, i + 1, data.items[i]]);
      }
    }
    if (data.links) {
      for (var j = 0; j < data.links.length; j++) {
        runSql("INSERT INTO list_links (list_id, title, url) VALUES (?,?,?)", [listId, data.links[j].title, data.links[j].url]);
      }
    }
    saveToFile();
    return listId;
  },

  // 更新清单（只更新传入的字段，未传入的保持原值）
  // items 和 links 会全量替换（先删后插）
  updateList: function (id, data) {
    var sets = [];
    var params = [];
    if (data.title !== undefined) { sets.push('title=?'); params.push(data.title); }
    if (data.product_code !== undefined) { sets.push('product_code=?'); params.push(data.product_code); }
    if (data.category !== undefined) { sets.push('category=?'); params.push(data.category); }
    if (data.author !== undefined) { sets.push('author=?'); params.push(data.author); }
    if (data.image !== undefined) { sets.push('image=?'); params.push(data.image); }
    if (data.status !== undefined) { sets.push('status=?'); params.push(data.status); }
    sets.push("updated_at=datetime('now','localtime')");
    if (sets.length > 0) {
      params.push(id);
      runSql("UPDATE lists SET " + sets.join(',') + " WHERE id=?", params);
    }
    // 先删后插：简化逻辑，避免逐条对比
    if (data.items) {
      runSql("DELETE FROM list_items WHERE list_id=?", [id]);
      for (var i = 0; i < data.items.length; i++) {
        runSql("INSERT INTO list_items (list_id, sort_order, content) VALUES (?,?,?)", [id, i + 1, data.items[i]]);
      }
    }
    if (data.links) {
      runSql("DELETE FROM list_links WHERE list_id=?", [id]);
      for (var j = 0; j < data.links.length; j++) {
        runSql("INSERT INTO list_links (list_id, title, url) VALUES (?,?,?)", [id, data.links[j].title, data.links[j].url]);
      }
    }
    saveToFile();
  },

  // 删除清单（级联删除子表数据）
  deleteList: function (id) {
    runSql("DELETE FROM list_items WHERE list_id=?", [id]);
    runSql("DELETE FROM list_links WHERE list_id=?", [id]);
    runSql("DELETE FROM lists WHERE id=?", [id]);
    saveToFile();
  },

  // 后台：获取所有清单（无分页，用于导出等场景）
  getAllLists: function () {
    return queryObjects("SELECT * FROM lists ORDER BY created_at DESC");
  },

  // 后台：分页获取所有清单
  getAllListsPaged: function (page, size) {
    var offset = (page - 1) * size;
    var total = getFirstValue("SELECT COUNT(*) FROM lists");
    var rows = queryObjects("SELECT * FROM lists ORDER BY created_at DESC LIMIT ? OFFSET ?", [size, offset]);
    return { rows: rows, total: total, page: page, size: size, totalPages: Math.ceil(total / size) || 1 };
  },

  // 后台：搜索清单（标题、分类、作者、状态、清单内容）
  // 使用 LEFT JOIN 关联 list_items 实现内容搜索
  searchAdminLists: function (keyword, page, size) {
    var offset = (page - 1) * size;
    var kw = '%' + keyword + '%';
    var total = getFirstValue("SELECT COUNT(DISTINCT l.id) FROM lists l LEFT JOIN list_items li ON li.list_id=l.id WHERE l.title LIKE ? OR l.category LIKE ? OR l.author LIKE ? OR l.status LIKE ? OR li.content LIKE ?", [kw, kw, kw, kw, kw]);
    var rows = queryObjects("SELECT DISTINCT l.* FROM lists l LEFT JOIN list_items li ON li.list_id=l.id WHERE l.title LIKE ? OR l.category LIKE ? OR l.author LIKE ? OR l.status LIKE ? OR li.content LIKE ? ORDER BY l.created_at DESC LIMIT ? OFFSET ?", [kw, kw, kw, kw, kw, size, offset]);
    for (var i = 0; i < rows.length; i++) {
      rows[i].items = queryObjects("SELECT content FROM list_items WHERE list_id = ? ORDER BY sort_order", [rows[i].id]).map(function (r) { return r.content; });
      rows[i].links = queryObjects("SELECT title, url FROM list_links WHERE list_id = ?", [rows[i].id]);
    }
    return { rows: rows, total: total, page: page, size: size, totalPages: Math.ceil(total / size) || 1 };
  },

  // ==========================================================
  // 分类相关方法
  // ==========================================================

  // 获取所有分类及每个分类下的已发布清单数量
  getCategories: function () {
    return queryObjects("SELECT c.*, (SELECT COUNT(*) FROM lists WHERE category=c.name AND status='published') AS count FROM categories c ORDER BY c.name");
  },

  // 新增分类（UNIQUE 约束保证不重复）
  addCategory: function (name) {
    try {
      runSql("INSERT INTO categories (name) VALUES (?)", [name]);
      saveToFile();
      return true;
    } catch (e) {
      return false; // 重复分类
    }
  },

  // 删除分类
  deleteCategory: function (id) {
    runSql("DELETE FROM categories WHERE id=?", [id]);
    saveToFile();
  },

  // ==========================================================
  // 留言相关方法
  // ==========================================================

  // 前台：分页获取已审核的留言
  getApprovedMessages: function (page, size) {
    var offset = (page - 1) * size;
    var total = getFirstValue("SELECT COUNT(*) FROM messages WHERE status='approved'");
    var rows = queryObjects("SELECT * FROM messages WHERE status='approved' ORDER BY created_at DESC LIMIT ? OFFSET ?", [size, offset]);
    return { rows: rows, total: total, page: page, size: size, totalPages: Math.ceil(total / size) || 1 };
  },

  // 后台：获取所有留言（无分页）
  getAllMessages: function () {
    return queryObjects("SELECT * FROM messages ORDER BY created_at DESC");
  },

  // 后台：分页获取所有留言
  getAllMessagesPaged: function (page, size) {
    var offset = (page - 1) * size;
    var total = getFirstValue("SELECT COUNT(*) FROM messages");
    var rows = queryObjects("SELECT * FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?", [size, offset]);
    return { rows: rows, total: total, page: page, size: size, totalPages: Math.ceil(total / size) || 1 };
  },

  // 提交新留言（默认状态为 pending 待审核）
  addMessage: function (data) {
    runSql("INSERT INTO messages (name, content, status) VALUES (?,?,'pending')", [data.name, data.content]);
    var id = getFirstValue("SELECT last_insert_rowid()");
    saveToFile();
    return id;
  },

  // 审核留言：修改状态（pending → approved / rejected）
  updateMessage: function (id, data) {
    if (data.status) {
      runSql("UPDATE messages SET status=? WHERE id=?", [data.status, id]);
      saveToFile();
    }
  },

  // 删除留言
  deleteMessage: function (id) {
    runSql("DELETE FROM messages WHERE id=?", [id]);
    saveToFile();
  },

  // 管理员回复留言
  replyMessage: function (id, replyContent, replyBy) {
    runSql("UPDATE messages SET reply_content=?, reply_at=datetime('now','localtime'), reply_by=? WHERE id=?",
      [replyContent, replyBy, id]);
    saveToFile();
  },

  // ==========================================================
  // 发布人相关方法
  // ==========================================================

  // 获取所有发布人（不返回密码字段）
  getAllPublishers: function () {
    return queryObjects("SELECT id, username, display_name, status, created_at FROM publishers ORDER BY created_at DESC");
  },

  // 根据 ID 获取发布人
  getPublisherById: function (id) {
    var rows = queryObjects("SELECT id, username, display_name, status, created_at FROM publishers WHERE id=?", [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  // 新增发布人（密码用 bcrypt 哈希存储）
  addPublisher: function (data) {
    try {
      var hash = bcrypt.hashSync(data.password, 10);
      runSql("INSERT INTO publishers (username, password, display_name, status) VALUES (?,?,?,?)",
        [data.username, hash, data.display_name || '', data.status || 'active']);
      saveToFile();
      return true;
    } catch (e) {
      return false; // 用户名重复
    }
  },

  // 更新发布人（只更新传入的字段，密码为空时不修改）
  updatePublisher: function (id, data) {
    var sets = [];
    var params = [];
    if (data.display_name !== undefined) { sets.push('display_name=?'); params.push(data.display_name); }
    if (data.status !== undefined) { sets.push('status=?'); params.push(data.status); }
    if (data.password) {
      var hash = bcrypt.hashSync(data.password, 10);
      sets.push('password=?');
      params.push(hash);
    }
    sets.push("updated_at=datetime('now','localtime')");
    if (sets.length > 0) {
      params.push(id);
      runSql("UPDATE publishers SET " + sets.join(',') + " WHERE id=?", params);
      saveToFile();
    }
  },

  // 验证发布人账号密码（用于发布清单时校验）
  authenticatePublisher: function (username, password) {
    var rows = queryObjects("SELECT * FROM publishers WHERE username=?", [username]);
    if (rows.length === 0) return null;
    if (bcrypt.compareSync(password, rows[0].password)) {
      return rows[0]; // 返回完整用户信息（含状态）
    }
    return null;
  },

  // ==========================================================
  // 站点设置相关方法
  // ==========================================================

  // 获取所有设置（返回键值对对象）
  getSettings: function () {
    var rows = queryObjects("SELECT * FROM settings");
    var obj = {};
    for (var i = 0; i < rows.length; i++) {
      obj[rows[i].key] = rows[i].value;
    }
    return obj;
  },

  // 获取前台公开的设置（只有站点名称和简介）
  getPublicSettings: function () {
    var rows = queryObjects("SELECT * FROM settings WHERE key IN ('site_name','site_intro')");
    var obj = {};
    for (var i = 0; i < rows.length; i++) {
      obj[rows[i].key] = rows[i].value;
    }
    return obj;
  },

  // 保存设置（批量：传入 { key: value, key2: value2 }）
  saveSettings: function (data) {
    for (var key in data) {
      runSql("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", [key, String(data[key])]);
    }
    saveToFile();
  },

  // ==========================================================
  // 管理员认证相关方法
  // ==========================================================

  // 管理员登录验证
  authenticate: function (username, password) {
    var rows = queryObjects("SELECT * FROM admin_users WHERE username=?", [username]);
    if (rows.length === 0) return null;
    if (bcrypt.compareSync(password, rows[0].password)) {
      return rows[0];
    }
    return null;
  },

  // 修改管理员密码
  updatePassword: function (adminId, newPassword) {
    var hash = bcrypt.hashSync(newPassword, 10);
    runSql("UPDATE admin_users SET password=? WHERE id=?", [hash, adminId]);
    saveToFile();
  },

};
