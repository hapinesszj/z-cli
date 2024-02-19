'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @description 判断是否为对象
 * @param {object} o
 * @author by hapinesszj
 */
function isObject(o) {
  return Object.prototype.toString.call(o) === '[object Object]';
}

/**
 * @description 判断是否为数组
 * @param {object} a
 * @author by hapinesszj
 */
function isArray(a) {
  return Object.prototype.toString.call(a) === '[object Array]';
}

/**
 * @description 该方法必须实现
 * @param {string} methodName
 * @author by hapinesszj
 */
function implementedError(methodName) {
  throw new Error(`${methodName} must be implemented!`);
}

/**
 * @description 通用抛出异常
 * @param {string} message
 * @author by hapinesszj
 */
function throwError(message) {
  throw new Error(message);
}

/**
 * @description 校验初始化项目名称
 * @param {string} name
 * @author by hapinesszj
 */
function isValidProjectName(name) {
  return /^(@[a-zA-Z0-9-_]+\/)?[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(name);
}

/**
 * @description 格式化路径，兼容(macOS/windows)
 * @param {string} p
 * @author by hapinesszj
 */
function formatPath(p) {
  if (p && typeof p === 'string') {
    const sep = path.sep;
    if (sep === '/') {
      return p;
    } else {
      return p.replace(/\\/g, '/');
    }
  }
  return p;
}

/**
 * @description 判断目录是否为空
 * @param {string} dir
 * @author by hapinesszj
 */
function isDirEmpty(dir) {
  let fileList = fs.readdirSync(dir);
  fileList = fileList.filter((file) => !file.startsWith('.') && ['node_modules'].indexOf(file) < 0);
  return !fileList || fileList.length <= 0;
}

/**
 * @description 文件读取
 * @param {string} path
 * @param {object} options
 * @author by hapinesszj
 */
function readFile(path, options = {}) {
  if (fs.existsSync(path)) {
    const buffer = fs.readFileSync(path);
    if (buffer) {
      if (options.toJson) {
        return buffer.toJSON();
      } else {
        return buffer.toString();
      }
    }
  }
  return null;
}

/**
 * @description 文件写入
 * @param {string} path
 * @param {string | object} data
 * @param {object} param2
 * @author by hapinesszj
 */
function writeFile(path, data, {rewrite = true} = {}) {
  if (fs.existsSync(path)) {
    if (rewrite) {
      fs.writeFileSync(path, data);
      return true;
    }
    return false;
  } else {
    fs.writeFileSync(path, data);
    return true;
  }
}

/**
 * @description 加载格式化
 * @param {string} msg
 * @param {string} spinnerString
 * @author by hapinesszj
 */
function spinnerStart(msg, spinnerString = '◐◓◑◒') {
  const Spinner = require('cli-spinner').Spinner;
  const spinner = new Spinner(msg + ' %s');
  spinner.setSpinnerString(spinnerString);
  spinner.start();
  return spinner;
}

/**
 * @description 暂停1分钟
 * @param {number} timeout
 * @author by hapinesszj
 */
function sleep(timeout = 1000) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * @description 子进程执行命令
 * @param {string} command
 * @param {array} args
 * @param {object} options
 * @author by hapinesszj
 */
function spawn(command, args, options) {
  const win32 = process.platform === 'win32';

  const cmd = win32 ? 'cmd' : command;
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args;

  return require('child_process').spawn(cmd, cmdArgs, options || {});
}

/**
 * @description 子进程执行命令 - 异步形式
 * @param {string} command
 * @param {array} args
 * @param {object} options
 * @author by hapinesszj
 */
function spawnAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, options);
    p.on('error', (e) => {
      reject(e);
    });
    p.on('exit', (c) => {
      resolve(c);
    });
  });
}

module.exports = {
  isObject,
  isArray,
  spinnerStart,
  isDirEmpty,
  sleep,
  readFile,
  writeFile,
  formatPath,
  spawn,
  spawnAsync,
  throwError,
  implementedError,
  isValidProjectName,
};
