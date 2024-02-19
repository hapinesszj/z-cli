'use strict';
const semver = require('semver');
const colors = require('colors/safe');
const log = require('@byte-sculpt/log');
const {isArray, implementedError, throwError} = require('@byte-sculpt/tools');
const {LOWEST_NODE_VERSION} = require('./constant');

class Command {
  /**
   * @description 命令基类构造器
   * @param {object} argv
   * @author by hapinesszj
   */
  constructor(argv) {
    if (!argv) {
      throwError('参数不能为空!');
    }

    if (!isArray(argv)) {
      throwError('参数必须为数组!');
    }

    if (argv.length < 1) {
      throwError('参数列表为空!');
    }

    this._argv = argv;

    const runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      chain = chain.then(() => this.checkNodeVersion());
      chain = chain.then(() => this.initArgs());
      chain = chain.then(() => this.init());
      chain = chain.then(() => this.exec());
      chain = chain.then(resolve);
      chain.catch((err) => {
        log.error(err.message);
        reject(err);
      });
    });

    this.runner = runner;
  }

  /**
   * @description 检查node版本
   * @author by hapinesszj
   */
  checkNodeVersion() {
    const currentVersion = process.version;
    const lowestVersion = LOWEST_NODE_VERSION;
    if (!semver.gte(currentVersion, lowestVersion)) {
      throwError(colors.red(`z-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`));
    }
  }

  /**
   * @description 初始化命令参数
   * @author by hapinesszj
   */
  initArgs() {
    this._cmd = this._argv[this._argv.length - 1];
    this._argv = this._argv.slice(0, this._argv.length - 1);
    log.verbose('initArgs', this._cmd, this._argv);
  }

  /**
   * @description 命令初始化实现
   * @author by hapinesszj
   */
  init() {
    implementedError('init');
  }

  /**
   * @description 命令执行实现
   * @author by hapinesszj
   */
  exec() {
    implementedError('exec');
  }
}

module.exports = Command;
