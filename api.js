// ============================================================
// 前端 HTTP 请求封装
// 职责：封装对后端 REST API 的所有调用
// 使用：全局 API 对象，所有页面共用
// ============================================================

var API = {
  baseUrl: '/api',  // 后端 API 前缀

  // ---- 核心请求方法 ----
  // 封装 XMLHttpRequest，统一处理 JSON 序列化和错误回调
  request: function (method, path, data, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, this.baseUrl + path, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.withCredentials = true;  // 跨域请求携带 Cookie（用于 session 认证）
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        try {
          var res = JSON.parse(xhr.responseText);
          callback(null, res, xhr.status);
        } catch (e) {
          callback(e);
        }
      }
    };
    xhr.send(data ? JSON.stringify(data) : null);
  },

  // HTTP 方法的便捷封装
  get: function (path, callback) { this.request('GET', path, null, callback); },
  post: function (path, data, callback) { this.request('POST', path, data, callback); },
  put: function (path, data, callback) { this.request('PUT', path, data, callback); },
  del: function (path, callback) { this.request('DELETE', path, null, callback); },

  // ---- 前台公开 API ----

  // 获取已发布清单列表（分页）
  getLists: function (page, size, callback) {
    this.get('/lists?page=' + (page || 1) + '&size=' + (size || 10), callback);
  },
  // 获取单条清单详情
  getListById: function (id, callback) { this.get('/lists/' + id, callback); },
  // 搜索已发布清单
  searchLists: function (q, page, size, callback) {
    this.get('/lists/search?q=' + encodeURIComponent(q) + '&page=' + (page || 1) + '&size=' + (size || 10), callback);
  },
  // 发布新清单（需验证发布人身份）
  createList: function (data, callback) { this.post('/lists', data, callback); },
  // 获取所有分类
  getCategories: function (callback) { this.get('/categories', callback); },
  // 获取已审核留言（分页）
  getMessages: function (page, size, callback) {
    this.get('/messages?page=' + (page || 1) + '&size=' + (size || 20), callback);
  },
  // 提交新留言（无需登录）
  addMessage: function (data, callback) { this.post('/messages', data, callback); },

  // ---- 管理员认证 ----

  // 管理员登录（创建 session）
  login: function (username, password, callback) {
    this.post('/auth/login', { username: username, password: password }, callback);
  },
  // 管理员退出
  logout: function (callback) { this.post('/auth/logout', {}, callback); },
  // 检查当前登录状态
  checkAuth: function (callback) { this.get('/auth/me', callback); },
  // 发布人登录验证（不创建 session，仅验证身份）
  publisherLogin: function (username, password, callback) {
    this.post('/auth/publisher-login', { username: username, password: password }, callback);
  },

  // ---- 后台管理 API（需管理员登录）----

  // 清单管理
  adminGetLists: function (callback) { this.get('/admin/lists', callback); },
  adminCreateList: function (data, callback) { this.post('/admin/lists', data, callback); },
  adminSearchLists: function (q, page, size, callback) {
    this.get('/admin/lists/search?q=' + encodeURIComponent(q) + '&page=' + (page || 1) + '&size=' + (size || 100), callback);
  },
  adminUpdateList: function (id, data, callback) { this.put('/admin/lists/' + id, data, callback); },
  adminDeleteList: function (id, callback) { this.del('/admin/lists/' + id, callback); },

  // 留言管理
  adminGetMessages: function (callback) { this.get('/admin/messages', callback); },
  adminUpdateMessage: function (id, data, callback) { this.put('/admin/messages/' + id, data, callback); },
  adminDeleteMessage: function (id, callback) { this.del('/admin/messages/' + id, callback); },
  adminReplyMessage: function (id, data, callback) { this.put('/admin/messages/' + id + '/reply', data, callback); },

  // 分类管理
  adminAddCategory: function (name, callback) { this.post('/admin/categories', { name: name }, callback); },
  adminDeleteCategory: function (id, callback) { this.del('/admin/categories/' + id, callback); },

  // 发布人管理
  adminGetPublishers: function (callback) { this.get('/admin/publishers', callback); },
  adminAddPublisher: function (data, callback) { this.post('/admin/publishers', data, callback); },
  adminUpdatePublisher: function (id, data, callback) { this.put('/admin/publishers/' + id, data, callback); },

  // 站点设置
  adminGetSettings: function (callback) { this.get('/admin/settings', callback); },
  adminSaveSettings: function (data, callback) { this.put('/admin/settings', data, callback); },
  adminChangePassword: function (password, callback) { this.put('/admin/password', { password: password }, callback); },
  getPublicSettings: function (callback) { this.get('/settings/public', callback); },

  // ---- 图片上传（特殊处理：使用 FormData 而非 JSON）----
  uploadImage: function (file, callback) {
    var formData = new FormData();
    formData.append('image', file);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', this.baseUrl + '/upload/image', true);
    xhr.withCredentials = true;
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        try {
          var res = JSON.parse(xhr.responseText);
          callback(null, res, xhr.status);
        } catch (e) { callback(e); }
      }
    };
    xhr.send(formData);
  }
};
