'use strict';

const commander = require('commander');
const colors = require('colors/safe');
const log = require('@byte-sculpt/log');
const exec = require('@byte-sculpt/exec');
const pkg = require('../package.json');
const {checkPkgVersion, checkRoot, checkUserHome, checkEnv, checkGlobalUpdate} = require('./prepare');

const program = new commander.Command();

/**
 * @description 流程调度
 * @author by hapinesszj
 */
async function core() {
  try {
    await prepare(); // 执行准备工作
    await registerCommand(); // 注册命令
  } catch (e) {
    log.error(e.message);
    if (program.debug) {
      console.log(e);
    }
  }
}

/**
 * @description 执行准备
 * @author by hapinesszj
 */
async function prepare() {
  checkPkgVersion(); // 检查版本号
  checkRoot(); // root降级
  checkUserHome(); // 检查用户主目录
  checkEnv(); // 检查环变量
  await checkGlobalUpdate(); // 检查是否最新版本
}

/**
 * @description 命令注册
 * @author by hapinesszj
 */
async function registerCommand() {
  // 注册全局参数
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '');

  // 注册init命令
  program.command('init [projectName]').option('-f, --force', '是否强制初始化项目').action(exec);

  // 注册publish命令
  program
    .command('publish')
    .option('--refreshServer', '强制更新远程Git仓库')
    .option('--refreshToken', '强制更新远程仓库token')
    .option('--refreshOwner', '强制更新远程仓库类型')
    .option('--buildCmd <buildCmd>', '构建命令')
    .option('--prod', '是否正式发布')
    .option('--sshUser <sshUser>', '模板服务器用户名')
    .option('--sshIp <sshIp>', '模板服务器IP或域名')
    .option('--sshPath <sshPath>', '模板服务器上传路径')
    .action(exec);

  // 监听debug
  program.on('option:debug', function () {
    if (program.debug) {
      process.env.LOG_LEVEL = 'verbose';
    } else {
      process.env.LOG_LEVEL = 'info';
    }

    log.level = process.env.LOG_LEVEL;
  });

  // 监听targetPath
  program.on('option:targetPath', function () {
    process.env.CLI_TARGET_PATH = program.targetPath;
  });

  // 监听未知命令
  program.on('command:*', function (obj) {
    const availableCommands = program.commands.map((cmd) => cmd.name());
    console.log(colors.red('未知的命令：' + obj[0]));
    if (availableCommands.length > 0) {
      console.log(colors.red('可用命令：' + availableCommands.join(',')));
    }
  });

  // 格式化参数
  program.parse(process.argv);

  // 未输入任何命令，自动展示帮助文档
  if (program.args && program.args.length < 1) {
    program.outputHelp();
    console.log();
  }
}

// 捕获了一个未处理的promise rejection, 因为我们已经有了对于未处理错误的后备的处理机制
process.on('unhandledRejection', (reason, p) => {
  console.log('unhandledRejection', reason, p);
  throw reason;
});

// 收到一个从未被处理的错误，现在处理它，并决定是否需要重启应用
process.on('uncaughtException', (error) => {
  console.log('uncaughtException', error);
  process.exit(1);
});

module.exports = core;
