const GitServer = require('./GitServer');
const GithubRequest = require('./GithubRequest');

class Github extends GitServer {
  /**
   * @description Git实现类
   * @author by hapinesszj
   */
  constructor() {
    super('github');
    this.request = null;
  }

  /**
   * @description 设置凭证
   * @param {string} token
   * @author by hapinesszj
   */
  setToken(token) {
    super.setToken(token);
    this.request = new GithubRequest(token);
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
   * @author by hapinesszj
   */
  getOrg() {
    return this.request.get(`/user/orgs`, {
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
    return this.request.get(`/repos/${login}/${name}`).then((response) => {
      return this.handleResponse(response);
    });
  }

  /**
   * @description 创建版本库
   * @param {string} name
   * @author by hapinesszj
   */
  createRepo(name) {
    return this.request.post(
      '/user/repos',
      {
        name,
      },
      {
        Accept: 'application/vnd.github.v3+json',
      }
    );
  }

  /**
   * @description 创建组织版本库
   * @param {string} login
   * @param {string} name
   * @author by hapinesszj
   */
  createOrgRepo(name, login) {
    return this.request.post(
      `/orgs/${login}/repos`,
      {
        name,
      },
      {
        Accept: 'application/vnd.github.v3+json',
      }
    );
  }

  /**
   * @description 获取凭证指引链接
   * @author by hapinesszj
   */
  getTokenUrl() {
    return 'https://github.com/settings/tokens';
  }

  /**
   * @description 获取凭证帮助链接
   * @author by hapinesszj
   */
  getTokenHelpUrl() {
    return 'https://docs.github.com/en/github/authenticating-to-github/connecting-to-github-with-ssh';
  }

  /**
   * @description 获取版本库地址
   * @param {string} login
   * @param {string} name
   * @author by hapinesszj
   */
  getRemote(login, name) {
    return `git@github.com:${login}/${name}.git`;
  }
}

module.exports = Github;
