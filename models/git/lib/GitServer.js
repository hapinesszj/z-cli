const {throwError} = require('@byte-sculpt/tools');

class GitServer {
  /**
   * @description Git基类
   * @param {string} type
   * @param {string} token
   * @author by hapinesszj
   */
  constructor(type, token) {
    this.type = type;
    this.token = token;
  }

  /**
   * @description 设置凭证
   * @param {string} token
   * @author by hapinesszj
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * @description 创建建远程版本库
   * @param {string} name
   * @author by hapinesszj
   */
  createRepo(name) {
    throwError('createRepo');
  }

  /**
   * @description 创建建远程组织库
   * @param {string} name
   * @param {string} login
   * @author by hapinesszj
   */
  createOrgRepo(name, login) {
    throwError('createOrgRepo');
  }

  /**
   * @description 获取远程版本库地址
   * @param {string} login
   * @param {string} name
   * @author by hapinesszj
   */
  getRemote(name, login) {
    throwError('getRemote');
  }

  /**
   * @description 获取用户信息
   * @author by hapinesszj
   */
  getUser() {
    throwError('getUser');
  }

  /**
   * @description 获取组织信息
   * @author by hapinesszj
   */
  getOrg() {
    throwError('getOrg');
  }

  /**
   * @description 获取版本库信息
   * @param {string} login
   * @param {string} name
   * @author by hapinesszj
   */
  getRepo(login, name) {
    throwError('getRepo');
  }

  /**
   * @description 获取凭证指引链接
   * @author by hapinesszj
   */
  getTokenUrl() {
    throwError('getTokenUrl');
  }

  /**
   * @description 获取凭证帮助链接
   * @author by hapinesszj
   */
  getTokenHelpUrl() {
    throwError('getTokenHelpUrl');
  }

  /**
   * @description 是否是正常响应状态
   * @param {*} response
   * @author by hapinesszj
   */
  isHttpResponse = (response) => {
    return response && response.status;
  };

  /**
   * @description 处理响应结果
   * @param {*} response
   * @author by hapinesszj
   */
  handleResponse = (response) => {
    if (this.isHttpResponse(response) && response !== 200) {
      return null;
    } else {
      return response;
    }
  };
}

module.exports = GitServer;
