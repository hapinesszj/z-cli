const GitServer = require('./GitServer');
const GiteeRequest = require('./GiteeRequest');

class Gitee extends GitServer {
  /**
   * @description Gitee实现类
   * @author by hapinesszj
   */
  constructor() {
    super('gitee');
    this.request = null;
  }

  /**
   * @description 设置凭证
   * @param {string} token
   * @author by hapinesszj
   */
  setToken(token) {
    super.setToken(token);
    this.request = new GiteeRequest(token);
  }

  /**
   * @description 获取用户信息
   * @author by hapinesszj
   */
  getUser() {
    return this.request.get('/user');
  }

  /**
   * @description 获取组织信息
   * @param {string} username
   * @author by hapinesszj
   */
  getOrg(username) {
    return this.request.get(`/users/${username}/orgs`, {
      page: 1,
      per_page: 100,
    });
  }

  /**
   * @description 获取版本库信息
   * @param {string} login
   * @param {string} name
   * @author by hapinesszj
   */
  getRepo(login, name) {
    return new Promise((resolve, reject) => {
      this.request
        .get(`/repos/${login}/${name}`)
        .then((response) => {
          resolve(response);
        })
        .catch((err) => reject(err));
    });
  }

  /**
   * @description 创建版本库
   * @param {string} name
   * @author by hapinesszj
   */
  createRepo(name) {
    return this.request.post('/user/repos', {
      name,
    });
  }

  /**
   * @description 创建组织版本库
   * @param {string} login
   * @param {string} name
   * @author by hapinesszj
   */
  createOrgRepo(name, login) {
    return this.request.post(`/orgs/${login}/repos`, {
      name,
    });
  }

  /**
   * @description 获取凭证指引链接
   * @author by hapinesszj
   */
  getTokenUrl() {
    return 'https://gitee.com/personal_access_tokens';
  }

  /**
   * @description 获取凭证帮助链接
   * @author by hapinesszj
   */
  getTokenHelpUrl() {
    return 'https://gitee.com/help/articles/4191';
  }

  /**
   * @description 获取版本库地址
   * @param {string} login
   * @param {string} name
   * @author by hapinesszj
   */
  getRemote(login, name) {
    return `git@gitee.com:${login}/${name}.git`;
  }
}

module.exports = Gitee;
