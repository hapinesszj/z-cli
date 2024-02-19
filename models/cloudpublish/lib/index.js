'use strict';

const io = require('socket.io-client');
const inquirer = require('inquirer');
const log = require('@byte-sculpt/log');
const request = require('@byte-sculpt/request');
const {parseMsg} = require('./helper');
const {WS_SERVER, TIME_OUT, CONNECT_TIME_OUT, FAILED_CODE} = require('./constant');

class CloudPublish {
  /**
   * @description 云发布构造器
   * @param {object} git
   * @param {object} options
   * @author by hapinesszj
   */
  constructor(git, options) {
    this.git = git;
    this.buildCmd = options.buildCmd;
    this.timeout = TIME_OUT;
    this.prod = options.prod;
    this.isHistoryRouter = options.isHistoryRouter;
  }

  /**
   * @description 发布预检
   * @author by hapinesszj
   */
  async prepare() {
    if (this.prod) {
      const projectName = this.git.name;
      const projectType = this.prod ? 'prod' : 'dev';
      const ossProject = await request({
        url: '/project/getOssTargetProject',
        params: {
          name: projectName,
          type: projectType,
        },
      });

      if (ossProject.code === 0 && ossProject.data && ossProject.data.length > 0) {
        const cover = (
          await inquirer.prompt({
            type: 'list',
            name: 'cover',
            choices: [
              {
                name: '覆盖发布',
                value: true,
              },
              {
                name: '放弃发布',
                value: false,
              },
            ],
            defaultValue: true,
            message: `OSS已存在 [${projectName}] 项目，是否强行覆盖发布？`,
          })
        ).cover;
        if (!cover) {
          throw new Error('发布终止');
        }
      }
    }
  }

  /**
   * @description 发布初始化
   * @returns Promise<socket.io-client>
   * @author by hapinesszj
   */
  init() {
    return new Promise((resolve, reject) => {
      const socket = io(WS_SERVER, {
        query: {
          gitType: this.git.gitType,
          login: this.git.login,
          name: this.git.name,
          branch: this.git.branch,
          version: this.git.version,
          buildCmd: this.buildCmd,
          isHistoryRouter: this.isHistoryRouter,
          prod: this.prod,
        },
      });

      socket.on('connect', () => {
        clearTimeout(this.timer);
        const {id} = socket;
        log.success('云发布任务创建成功', `任务ID: ${id}`);

        socket.on(id, (msg) => {
          const parsedMsg = parseMsg(msg);
          log.success(parsedMsg.action, parsedMsg.message);
        });

        resolve();
      });

      const disconnect = () => {
        clearTimeout(this.timer);
        socket.disconnect();
        socket.close();
      };

      this._doTimeout(() => {
        log.error('云发布服务连接超时，自动终止');
        disconnect();
      }, CONNECT_TIME_OUT);

      // 监听websocket断连
      socket.on('disconnect', () => {
        log.success('disconnect', '云发布任务断开');
        disconnect();
      });

      // 监听websocket错误
      socket.on('error', (err) => {
        log.error('error', '云发布出错！', err);
        disconnect();
        reject(err);
      });

      this.socket = socket;
    });
  }

  /**
   * @description 执行发布动作
   * @returns blooean true | false
   * @author by hapinesszj
   */
  publish() {
    let ret = true;
    return new Promise((resolve, reject) => {
      // 客户端发送发布请求
      this.socket.emit('publish');
      this.socket.on('publish', (msg) => {
        const parsedMsg = parseMsg(msg);
        if (FAILED_CODE.indexOf(parsedMsg.action) >= 0) {
          log.error(parsedMsg.action, parsedMsg.message);
          clearTimeout(this.timer);
          this.socket.disconnect();
          this.socket.close();
          ret = false;
        } else {
          log.success(parsedMsg.action, parsedMsg.message);
        }
      });

      // 监听构建过程，输出流到控制台
      this.socket.on('building', (msg) => {
        console.log(msg);
      });

      // 监听websocket断连
      this.socket.on('disconnect', () => {
        resolve(ret);
      });

      // 监听websocket错误
      this.socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * @description 设置IO超时时间
   * @param {function} fn
   * @param {number} timeout
   * @author by hapinesszj
   */
  _doTimeout(fn, timeout) {
    this.timer && clearTimeout(this.timer);
    log.info('设置任务超时时间：', `${timeout / 1000}秒`);
    this.timer = setTimeout(fn, timeout);
  }
}

module.exports = CloudPublish;
