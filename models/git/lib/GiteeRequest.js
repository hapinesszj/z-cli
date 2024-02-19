const axios = require('axios');
const BASE_URL = 'https://gitee.com/api/v5';

class GiteeRequest {
  /**
   * @description Gitee 请求类
   * @param {string} token
   * @author by hapinesszj
   */
  constructor(token) {
    this.token = token;
    this.service = axios.create({
      baseURL: BASE_URL,
      timeout: 5000,
    });
    this.service.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error) => {
        if (error.response && error.response.data) {
          return error.response;
        } else {
          return Promise.reject(error);
        }
      }
    );
  }

  /**
   * @description GET统一请求
   * @param {string} url
   * @param {object} params
   * @param {object} headers
   * @author by hapinesszj
   */
  get(url, params, headers) {
    return this.service({
      url,
      params: {
        ...params,
        access_token: this.token,
      },
      method: 'get',
      headers,
    });
  }

  /**
   * @description POST统一请求
   * @param {string} url
   * @param {object} data
   * @param {object} headers
   * @author by hapinesszj
   */
  post(url, data, headers) {
    return this.service({
      url,
      params: {
        access_token: this.token,
      },
      data,
      method: 'post',
      headers,
    });
  }
}

module.exports = GiteeRequest;
