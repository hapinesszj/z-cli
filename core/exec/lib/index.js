'use strict';

const path = require('path');
const log = require('@byte-sculpt/log');
const {spawn} = require('@byte-sculpt/tools');
const Package = require('@byte-sculpt/package');
const {SETTINGS, CACHE_DIR} = require('./constant');

/**
 * @description 动态执行命令包
 * @author by hapinesszj
 */
async function exec() {
  const homePath = process.env.CLI_HOME_PATH;
  let targetPath = process.env.CLI_TARGET_PATH;
  let storeDir = '',
    pkg = null;

  log.verbose('targetPath', targetPath);
  log.verbose('homePath', homePath);

  const cmdObj = arguments[arguments.length - 1];
  const cmdName = cmdObj.name();
  const packageName = SETTINGS[cmdName];
  const packageVersion = 'latest';

  if (!targetPath) {
    targetPath = path.resolve(homePath, CACHE_DIR);
    storeDir = path.resolve(targetPath, 'node_modules');

    log.verbose('targetPath', targetPath);
    log.verbose('storeDir', storeDir);

    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion,
    });

    const isexists = await pkg.exists(); // 缓存是否存在包

    if (isexists) {
      // 更新包
      await pkg.update();
    } else {
      // 安装包
      await pkg.install();
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion,
    });
  }

  const entryFile = pkg.getEntryFilePath();

  if (entryFile) {
    try {
      const args = Array.from(arguments);
      const cmd = args[args.length - 1];
      const o = Object.create(null);
      Object.keys(cmd).forEach((key) => {
        if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
          o[key] = cmd[key];
        }
      });
      args[args.length - 1] = o;
      const code = `require('${entryFile}').call(null, ${JSON.stringify(args)})`;

      // 启动子进程执行命令
      const childProcess = spawn('node', ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit', // 流形式输出在主进程，可以看到子进程执行命令的过程
      });

      childProcess.on('error', (e) => {
        log.error(e.message);
        process.exit(1);
      });

      childProcess.on('exit', (e) => {
        log.verbose('命令执行成功:' + e);
        process.exit(e);
      });
    } catch (error) {
      log.error(error.message);
    }
  }
}

module.exports = exec;
