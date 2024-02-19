'use strict';
const path = require('path');
const semver = require('semver');
const colors = require('colors');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;
const log = require('@byte-sculpt/log');
const pkg = require('../package.json');
const {getNpmSemverVersion} = require('@byte-sculpt/npm');
const {throwError} = require('@byte-sculpt/tools');
const {DEFAULT_CLI_HOME} = require('./constant');

/**
 * @description 检查脚手架版本
 * @author by hapinesszj
 */
function checkPkgVersion() {
  log.info('cli', `${pkg.version} 版本`);
}

/**
 * @description root权限降级
 * @author by hapinesszj
 */
function checkRoot() {
  require('root-check')();
}

/**
 * @description 检查用户主目录
 * @author by hapinesszj
 */
function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throwError(colors.red('当前登录用户主目录不存在！'));
  }
}

/**
 * @description 检查环境变量
 * @author by hapinesszj
 */
function checkEnv() {
  const dotenv = require('dotenv');
  const dotenvPath = path.resolve(userHome, '.env');

  const cliConfig = {};
  if (pathExists(dotenvPath)) {
    dotenv.config({
      path: dotenvPath,
    });
  }

  function _createDefaultConfig() {
    if (process.env.CLI_HOME) {
      cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME);
    } else {
      cliConfig['cliHome'] = path.join(userHome, DEFAULT_CLI_HOME);
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome;
  }

  // 传递全局环境变量
  _createDefaultConfig();
}

/**
 * @description 检查版本更新
 * @author by hapinesszj
 */
async function checkGlobalUpdate() {
  const currentVersion = pkg.version;
  const npmName = pkg.name;
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(colors.yellow(`请手动更新 ${npmName}，当前版本：${currentVersion}，最新版本：${lastVersion}更新命令： npm install -g ${npmName}`));
  }
}

module.exports = {
  checkEnv,
  checkRoot,
  checkUserHome,
  checkPkgVersion,
  checkGlobalUpdate,
};
