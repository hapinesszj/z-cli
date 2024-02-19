'use strict';

const inquirer = require('inquirer');
const fse = require('fs-extra');
const glob = require('glob');
const ejs = require('ejs');
const semver = require('semver');
const userHome = require('user-home');
const colors = require('colors/safe');
const Command = require('@byte-sculpt/command');
const Package = require('@byte-sculpt/package');
const request = require('@byte-sculpt/request');
const log = require('@byte-sculpt/log');
const {isDirEmpty, isValidProjectName, spinnerStart, sleep, spawnAsync, throwError} = require('@byte-sculpt/tools');
const {TYPE_PROJECT, TYPE_COMPONENT, TEMPLATE_TYPE_NORMAL, TEMPLATE_TYPE_CUSTOM, WHITE_COMMAND} = require('./constant');

class InitCommand extends Command {
  /**
   * @description 初始化
   * @author by hapinesszj
   */
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this._cmd.force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }

  /**
   * @description 命令执行动作
   * @author by hapinesszj
   */
  async exec() {
    try {
      // 执行准备
      const projectInfo = await this.prepare();

      if (projectInfo) {
        // 下载模板
        log.verbose('projectInfo', projectInfo);

        this.projectInfo = projectInfo;
        await this.downloadTemplate();

        // 安装模板
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e);
      }
    }
  }

  /**
   * @description 初始化预检
   * @author by hapinesszj
   */
  async prepare() {
    const {data} = await request({
      url: '/project/getTemplates',
    });

    if (!data || data.length === 0) {
      throwError('项目模板不存在');
    }

    this.template = data;
    const localPath = process.cwd();
    if (!isDirEmpty(localPath)) {
      let ifContinue = false;

      if (!this.force) {
        // 非强制初始化
        ifContinue = (
          await inquirer.prompt({
            type: 'confirm',
            name: 'ifContinue',
            default: false,
            message: '当前文件夹不为空，是否继续创建项目？',
          })
        ).ifContinue;

        log.verbose('ifContinue', ifContinue);

        if (!ifContinue) return;
      } else {
        // 启动强制初始化，二次确认是否强制清空目录下文件
        const {confirmDelete} = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？',
        });

        log.verbose('confirmDelete', confirmDelete);

        if (confirmDelete) {
          fse.emptyDirSync(localPath);
        }
      }
    }

    return this._getProjectInfo();
  }

  /**
   * @description 下载模版
   * @author by hapinesszj
   */
  async downloadTemplate() {
    const {projectTemplate} = this.projectInfo;
    const templateInfo = this.template.find((item) => item.npmName === projectTemplate);
    const targetPath = path.resolve(userHome, '.z-cli', 'template');
    const storeDir = path.resolve(userHome, '.z-cli', 'template', 'node_modules');
    const {npmName, version} = templateInfo;

    this.templateInfo = templateInfo;
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version,
    });

    if (!(await templateNpm.exists())) {
      const spinner = spinnerStart('正在下载模板...');
      await sleep();
      try {
        await templateNpm.install();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('下载模板成功');
          this.templateNpm = templateNpm;
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模板...');
      await sleep();
      try {
        await templateNpm.update();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('更新模板成功');
          this.templateNpm = templateNpm;
        }
      }
    }
  }

  /**
   * @description 安装模版
   * @author by hapinesszj
   */
  async installTemplate() {
    log.verbose('templateInfo', this.templateInfo);

    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        // 标准安装
        await this._installNormalTemplate();
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装
        await this._installCustomTemplate();
      } else {
        throwError('无法识别项目模板类型！');
      }
    } else {
      throwError('项目模板信息不存在！');
    }
  }

  /**
   * @description 默认安装
   * @author by hapinesszj
   */
  async _installNormalTemplate() {
    log.verbose('templateNpm', this.templateNpm);

    let spinner = spinnerStart('正在安装模板...');
    await sleep();

    const targetPath = process.cwd();
    const templateIgnore = this.templateInfo.ignore || [];
    const ignore = ['**/node_modules/**', ...templateIgnore];
    const {installCommand, startCommand} = this.templateInfo;

    try {
      const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);

      // ejs模版渲染
      await this._ejsRender({ignore});

      // 安装依赖、启动命令执行（交由用户去执行）
      // await this._execCommand(installCommand, '依赖安装失败！');
      // await this._execCommand(startCommand, '启动执行命令失败！');
    } catch (e) {
      throw e;
    } finally {
      spinner.stop(true);
      log.success('模板安装成功');
      console.log(`\nDone. Now run:\n\n  ${colors.cyan(installCommand)}\n  ${colors.cyan(startCommand)}\n`);
    }
  }

  /**
   * @description 自定义安装
   * @author by hapinesszj
   */
  async _installCustomTemplate() {
    if (await this.templateNpm.exists()) {
      const entryFile = this.templateNpm.getEntryFilePath();
      if (fs.existsSync(entryFile)) {
        log.notice('开始执行自定义模板');
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: process.cwd(),
        };
        const code = `require('${rootFile}')(${JSON.stringify(options)})`;
        log.verbose('code', code);
        await spawnAsync('node', ['-e', code], {stdio: 'inherit', cwd: process.cwd()});
        log.success('自定义模板安装成功');
      } else {
        throwError('自定义模板入口文件不存在');
      }
    }
  }

  /**
   * @description ejs模版渲染
   * @param {object} options
   * @author by hapinesszj
   */
  async _ejsRender(options) {
    const dir = process.cwd();
    const projectInfo = this.projectInfo;
    return new Promise((ejsResolve, ejsReject) => {
      glob(
        '**',
        {
          cwd: dir,
          ignore: options.ignore || '',
          nodir: true,
        },
        function (err, files) {
          if (err) {
            ejsReject(err);
          }

          const taskFiles = files.map((file) => {
            const filePath = path.join(dir, file);
            return new Promise((taskResolve, taskReject) => {
              ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
                if (err) {
                  taskReject(err);
                }

                fse.writeFileSync(filePath, result);
                taskResolve(result);
              });
            });
          });

          Promise.all(taskFiles)
            .then(() => {
              ejsResolve();
            })
            .catch((err) => {
              ejsReject(err);
            });
        }
      );
    });
  }

  /**
   * @description 启动相关命令
   * @param {string} command
   * @param {string} errMsg
   * @author by hapinesszj
   */
  async _execCommand(command, errMsg) {
    let ret;

    if (command) {
      const cmdArray = command.split(' ');
      const cmd = WHITE_COMMAND.includes(cmdArray[0]) ? cmdArray[0] : null;
      if (!cmd) {
        throwError('命令不存在！命令：' + command);
      }
      const args = cmdArray.slice(1);
      ret = await spawnAsync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    }
    if (ret !== 0) {
      throwError(errMsg);
    }
    return ret;
  }

  /**
   * @description 获取项目信息
   * @author by hapinesszj
   */
  async _getProjectInfo() {
    let projectInfo = {};
    let isProjectNameValid = false;
    if (isValidProjectName(this.projectName)) {
      isProjectNameValid = true;
      projectInfo.projectName = this.projectName;
    }

    const {type} = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT,
        },
        {
          name: '组件',
          value: TYPE_COMPONENT,
        },
      ],
    });

    log.verbose('type', type);

    // 隔离数据
    this.template = this.template.filter((template) => template.tag.includes(type));

    let title;
    if (type === TYPE_PROJECT) {
      title = '项目';
    } else if (type === TYPE_COMPONENT) {
      title = '组件';
    }

    const projectPrompt = [];
    const templateList = this.template;

    // 不符合项目名称，让用户进行输入
    if (!isProjectNameValid) {
      projectPrompt.push({
        type: 'input',
        name: 'projectName',
        message: `请输入${title}名称`,
        default: '',
        validate: function (v) {
          const done = this.async();
          setTimeout(function () {
            // 1.首字符必须为英文字符
            // 2.尾字符必须为英文或数字，不能为字符
            // 3.字符仅允许"-_"
            if (!isValidName(v)) {
              done(`请输入合法的${title}名称`);
              return;
            }
            done(null, true);
          }, 0);
        },
        filter: function (v) {
          return v;
        },
      });
    }
    projectPrompt.push(
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${title}版本号`,
        default: '1.0.0',
        validate: function (v) {
          const done = this.async();
          setTimeout(function () {
            if (!!!semver.valid(v)) {
              done('请输入合法的版本号');
              return;
            }
            done(null, true);
          }, 0);
        },
        filter: function (v) {
          if (!!semver.valid(v)) {
            return semver.valid(v);
          } else {
            return v;
          }
        },
      },
      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${title}模板`,
        choices: templateList.map((item) => ({
          value: item.npmName,
          name: item.name,
        })),
      }
    );

    if (type === TYPE_PROJECT) {
      const project = await inquirer.prompt(projectPrompt);

      projectInfo = {
        type,
        ...projectInfo,
        ...project,
      };
    } else if (type === TYPE_COMPONENT) {
      projectPrompt.push({
        type: 'input',
        name: 'componentDescription',
        message: '请输入组件描述信息',
        default: '',
        validate: function (v) {
          const done = this.async();
          setTimeout(function () {
            if (!v) {
              done('请输入组件描述信息');
              return;
            }
            done(null, true);
          }, 0);
        },
      });
      const component = await inquirer.prompt(projectPrompt);

      projectInfo = {
        type,
        ...projectInfo,
        ...component,
      };
    }

    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName;
      projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '');
    }

    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion;
    }

    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription;
    }

    return projectInfo;
  }
}

/**
 * 初始化init对象
 * @param {object} argv
 * @returns class InitCommand
 */
function init(argv) {
  log.verbose('argv', argv);
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
