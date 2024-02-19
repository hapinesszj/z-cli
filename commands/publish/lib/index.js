'use strict';

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const log = require('@byte-sculpt/log');
const Git = require('@byte-sculpt/git');
const Command = require('@byte-sculpt/command');
const {throwError} = require('@byte-sculpt/tools');

class PublishCommand extends Command {
  /**
   * @description 执行准备
   * @author by hapinesszj
   */
  prepare() {
    const projectPath = process.cwd();
    const pkgPath = path.resolve(projectPath, 'package.json');
    const pkg = fse.readJsonSync(pkgPath);
    const {name, version, scripts} = pkg;

    // 确认项目是否为npm项目
    log.verbose('package.json', pkgPath);
    if (!fs.existsSync(pkgPath)) {
      throwError('package.json不存在！');
    }

    // 确认是否包含name、version、build命令
    log.verbose('package.json', name, version, scripts);
    if (!name || !version || !scripts || !scripts.build) {
      throwError('package.json信息不全，请检查是否存在name、version和scripts（需提供build命令）！');
    }
    this.projectInfo = {name, version, dir: projectPath};
  }

  /**
   * @description 执行初始化
   * @author by hapinesszj
   */
  init() {
    // 处理参数
    log.verbose('publish argv', this._argv);
    log.verbose('publish cmd', this._cmd);

    this.options = {
      refreshServer: this._cmd.refreshServer,
      refreshToken: this._cmd.refreshToken,
      refreshOwner: this._cmd.refreshOwner,
      buildCmd: this._cmd.buildCmd,
      prod: this._cmd.prod,
      sshUser: this._cmd.sshUser,
      sshIp: this._cmd.sshIp,
      sshPath: this._cmd.sshPath,
    };
  }

  /**
   * @description 命令执行动作
   * @author by hapinesszj
   */
  async exec() {
    try {
      const startTime = new Date().getTime();

      // 执行准备
      this.prepare();

      // GitFlow自动化
      const git = new Git(this.projectInfo, this.options);
      await git.prepare(); // 代码自动化提交预检
      await git.commit(); // 代码自动化提交
      await git.publish(); // 代码自动化发布

      const endTime = new Date().getTime();
      log.info('本次发布耗时：', Math.floor((endTime - startTime) / 1000) + '秒');
    } catch (e) {
      log.error(e.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e);
      }
    }
  }
}

function publish(argv) {
  return new PublishCommand(argv);
}

module.exports = publish;
module.exports.PublishCommand = PublishCommand;
