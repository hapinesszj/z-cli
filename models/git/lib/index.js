'use strict';

const fs = require('fs');
const path = require('path');
const SimpleGit = require('simple-git');
const fse = require('fs-extra');
const userHome = require('user-home');
const inquirer = require('inquirer');
const terminalLink = require('terminal-link');
const semver = require('semver');
const log = require('@byte-sculpt/log');
const {readFile, writeFile, spinnerStart} = require('@byte-sculpt/tools');
const request = require('@byte-sculpt/request');
const CloudPublish = require('@byte-sculpt/cloudpublish');
const Github = require('./Github');
const Gitee = require('./Gitee');

const {
  GITHUB,
  GITEE,
  REPO_OWNER_USER,
  DEFAULT_CLI_HOME,
  GIT_ROOT_DIR,
  GIT_SERVER_FILE,
  GIT_TOKEN_FILE,
  GIT_OWN_FILE,
  GIT_LOGIN_FILE,
  GIT_IGNORE_FILE,
  GIT_PUBLISH_FILE,
  VERSION_RELEASE,
  VERSION_DEVELOP,
  TEMPLATE_TEMP_DIR,
  GIT_SERVER_TYPE,
  GIT_OWNER_TYPE,
  GIT_OWNER_TYPE_ONLY,
  GIT_PUBLISH_TYPE,
} = require('./constant');

class Git {
  /**
   * @description Git 构造器
   * @param {object} param0
   * @param {object} param1
   * @author by hapinesszj
   */
  constructor(
    {name, version, dir},
    {refreshServer = false, refreshToken = false, refreshOwner = false, buildCmd = '', prod = false, sshUser = '', sshIp = '', sshPath = ''}
  ) {
    if (name.startsWith('@') && name.indexOf('/') > 0) {
      const nameArray = name.split('/');
      this.name = nameArray.join('_').replace('@', '');
    } else {
      this.name = name; // 项目名称
    }
    this.version = version; // 项目版本
    this.dir = dir; // 源码目录
    this.gitCloneCacheDir = null; // GitClone缓存目录
    this.gitSourceCodeDir = null; // GitClone缓存源码目录
    this.git = SimpleGit(dir); // SimpleGit实例
    this.gitServer = null; // GitServer实例
    this.gitType = null; // GitServer类型
    this.homePath = null; // 本地缓存目录
    this.user = null; // 用户信息
    this.orgs = null; // 用户所属组织列表
    this.owner = null; // 远程仓库类型
    this.login = null; // 远程仓库登录名
    this.repo = null; // 远程仓库信息
    this.remote = null; // 远程仓库地址
    this.refreshServer = refreshServer; // 是否强制刷新远程仓库
    this.refreshToken = refreshToken; // 是否强化刷新远程仓库token
    this.refreshOwner = refreshOwner; // 是否强化刷新远程仓库类型
    this.branch = null; // 本地开发分支
    this.buildCmd = buildCmd; // 构建命令
    this.gitPublish = null; // 静态托管图床类型
    this.prod = prod; // 是否正式发布
    this.sshUser = sshUser; // 服务器用户名
    this.sshIp = sshIp; // 服务器IP
    this.sshPath = sshPath; // 服务器上传路径
    log.verbose('ssh config', this.sshUser, this.sshIp, this.sshPath);
  }

  /**
   * @description 代码自动化提交预检
   * @author by hapinesszj
   */
  async prepare() {
    await this._initialize(); // 初始化检查
    await this._checkRemoteRepo(); // 检查并创建远程仓库
    await this._initLocalRepo(); // 完成本地仓库初始化并关联远程仓库
  }

  /**
   * @description 代码自动化提交
   * @author by hapinesszj
   */
  async commit() {
    await this._getCorrectVersion(); // 获取开发分支
    await this._checkStash(); // 检查stash区
    await this._checkConflicted(); // 检查代码冲突
    await this._checkNotCommitted(); // 检查未提交代码
    await this._checkoutBranch(this.branch); // 切换开发分支
    await this._pullRemoteMainAndBranch(); // 合并远程main分支和开发分支代码
    await this._pushRemoteRepo(this.branch); // 将开发分支推送到远程仓库
  }

  /**
   * @description 代码自动化发布
   * @author by hapinesszj
   */
  async publish() {
    let ret = false;
    await this._preparePublish(); // 发布预检
    const cloudPublish = new CloudPublish(this, {
      buildCmd: this.buildCmd,
      type: this.gitPublish,
      prod: this.prod,
      isHistoryRouter: this.sshIp && this.sshPath ? true : false,
    });
    await cloudPublish.prepare(); // 发布准备
    await cloudPublish.init(); // 发布初始化
    ret = await cloudPublish.publish(); // 执行发布流程
    if (ret) {
      await this._uploadTemplate(); // 处理history路由情况
    }

    if (this.prod && ret) {
      this._runCreateTagTask(); // 创建发布tag标识、以及清理工作
    }
  }

  /**
   * @description 初始化检查
   * @author by hapinesszj
   */
  async _initialize() {
    this._checkHomePath(); //检查用户主目录
    await this._checkGitServer(); // 检查用户远程仓库类型
    await this._checkGitToken(); // 检查是否获取远程仓库Token
    await this._getUserAndOrgs(); // 获取远程仓库用户和组织信息
    await this._checkGitOwner(); // 确认远程仓库类型
  }

  /**
   * @description 检查并创建远程仓库
   * @author by hapinesszj
   */
  async _checkRemoteRepo() {
    let repo = await this.gitServer.getRepo(this.login, this.name);
    if (!repo) {
      let spinner = spinnerStart('开始创建远程仓库');
      try {
        if (this.owner === REPO_OWNER_USER) {
          repo = await this.gitServer.createRepo(this.name);
        } else {
          this.gitServer.createOrgRepo(this.name, this.login);
        }
      } catch (e) {
        log.error(e);
      } finally {
        spinner.stop(true);
      }
      if (repo) {
        log.success('远程仓库创建成功');
      } else {
        throw new Error('远程仓库创建失败');
      }
    } else {
      log.success('远程仓库信息获取成功');
    }
    log.verbose('repo', repo);
    this.repo = repo;
  }

  /**
   * @description 初始化本地仓库并关联远程仓库
   * @author by hapinesszj
   */
  async _initLocalRepo() {
    if (await this._getRemote()) return;

    this._checkGitIgnore(); // 检查并创建.gitignore文件
    await this._initAndAddRemote(); // 初始化并添加远程仓库地址
    await this._initCommit(); // 初始化提交代码
  }

  /**
   * @description 初始化并添加远程仓库地址
   * @author by hapinesszj
   */
  async _initAndAddRemote() {
    log.info('执行git初始化');
    await this.git.init(this.dir);

    log.info('添加git remote');
    const remotes = await this.git.getRemotes();
    if (!remotes.find((item) => item.name === 'origin')) {
      await this.git.addRemote('origin', this.remote);
    }
  }

  /**
   * @description 初始化提交代码
   * @author by hapinesszj
   */
  async _initCommit() {
    await this._checkConflicted(); // 检查代码冲突
    await this._checkNotCommitted(); // 检查未提交代码

    if (await this._checkRemoteMain()) {
      // --allow-unrelated-histories --rebase
      await this._pullRemoteRepo('main', {
        '--rebase': null,
      });
    } else {
      await this._pushRemoteRepo('main');
    }
  }

  /**
   * @description 发布预检查
   * @author by hapinesszj
   */
  async _preparePublish() {
    log.info('开始进行云构建前代码检查');
    const pkg = this._getPackageJson();
    if (this.buildCmd) {
      const buildCmdArray = this.buildCmd.split(' ');
      if (buildCmdArray[0] !== 'npm' && buildCmdArray[0] !== 'cnpm') {
        throw new Error('Build命令非法，必须使用npm或cnpm！');
      }
    } else {
      this.buildCmd = 'npm run build';
    }
    const buildCmdArray = this.buildCmd.split(' ');
    const lastCmd = buildCmdArray[buildCmdArray.length - 1];
    if (!pkg.scripts || !Object.keys(pkg.scripts).includes(lastCmd)) {
      throw new Error(this.buildCmd + '命令不存在！');
    }
    log.success('代码预检查通过');
    const gitPublishPath = this._createGitPath(GIT_PUBLISH_FILE);
    let gitPublish = readFile(gitPublishPath);
    if (!gitPublish) {
      gitPublish = (
        await inquirer.prompt({
          type: 'list',
          choices: GIT_PUBLISH_TYPE,
          message: '请选择您想要上传代码的平台',
          name: 'gitPublish',
        })
      ).gitPublish;
      writeFile(gitPublishPath, gitPublish);
      log.success('git publish类型写入成功', `${gitPublish} -> ${gitPublishPath}`);
    } else {
      log.success('git publish类型获取成功', gitPublish);
    }
    this.gitPublish = gitPublish;
  }

  /**
   * @description 上传模版
   * @author by hapinesszj
   */
  async _uploadTemplate() {
    const TEMPLATE_FILE_NAME = 'index.html';
    if (this.sshUser && this.sshIp && this.sshPath) {
      log.info('开始下载模板文件');
      let ossTemplateFile = await request({
        url: '/project/getOssTargetFile',
        params: {
          name: this.name,
          type: this.prod ? 'prod' : 'dev',
          file: TEMPLATE_FILE_NAME,
        },
      });
      if (ossTemplateFile.code === 0 && ossTemplateFile.data) {
        ossTemplateFile = ossTemplateFile.data;
      }
      log.verbose('模板文件url:', ossTemplateFile.url);
      const response = await request({
        url: ossTemplateFile.url,
      });
      if (response) {
        const ossTempDir = path.resolve(this.homePath, TEMPLATE_TEMP_DIR, `${this.name}@${this.version}`);
        if (!fs.existsSync(ossTempDir)) {
          fse.mkdirpSync(ossTempDir);
        } else {
          fse.emptyDirSync(ossTempDir);
        }
        const templateFilePath = path.resolve(ossTempDir, TEMPLATE_FILE_NAME);
        fse.createFileSync(templateFilePath);
        fs.writeFileSync(templateFilePath, response);
        log.success('模板文件下载成功', templateFilePath);
        log.info('开始上传模板文件至服务器');
        const uploadCmd = `scp -r ${templateFilePath} ${this.sshUser}@${this.sshIp}:${this.sshPath}`;
        log.verbose('uploadCmd', uploadCmd);
        const ret = require('child_process').execSync(uploadCmd);
        log.success('模板文件上传成功');
        fse.emptyDirSync(ossTempDir);
      }
    }
  }

  /**
   * @description 创建发布tag、以及清理工作
   * @author by hapinesszj
   */
  async _runCreateTagTask() {
    await this._checkandAddTag(); // 检查并创建tag
    await this._checkoutBranch('main'); // 切换主分支
    await this._mergeBranchToMaster('main'); // 归并到主分支
    await this._pushRemoteRepo('main'); // 推送主分支
    await this._deleteLocalBranch(); // 删除本地开发分支
    await this._deleteRemoteBranch(); // 删除远程开发分支
  }

  /**
   * @description 检查本地、远程tag
   * @author by hapinesszj
   */
  async _checkandAddTag() {
    log.info('获取远程tag列表');
    const tag = `${VERSION_RELEASE}/${this.version}`;
    const tagList = await this._getRemoteBranchList(VERSION_RELEASE);
    if (tagList.includes(this.version)) {
      log.success('远程tag已存在', tag);
      await this.git.push(['origin', `:refs/tags/${tag}`]);
      log.success('远程tag已删除', tag);
    }
    const localTagList = await this.git.tags();
    if (localTagList.all.includes(tag)) {
      log.success('本地tag已存在', tag);
      await this.git.tag(['-d', tag]);
      log.success('本地tag已删除', tag);
    }
    await this.git.addTag(tag);
    log.success('本地tag创建成功', tag);
    await this.git.pushTags('origin');
    log.success('tag推送远程成功', tag);
  }

  /**
   * @description 归并到主分支
   * @author by hapinesszj
   */
  async _mergeBranchToMaster() {
    log.info('开始合并本地开发分支代码', `[${this.branch}] -> [main]`);
    await this.git.mergeFromTo(this.branch, 'main');
    log.success('代码本地开发分支代码成功', `[${this.branch}] -> [main]`);
  }

  /**
   * @description 删除本地开发分支
   * @author by hapinesszj
   */
  async _deleteLocalBranch() {
    log.info('开始删除本地开发分支', this.branch);
    await this.git.deleteLocalBranch(this.branch);
    log.success('删除本地分支成功', this.branch);
  }

  /**
   * @description 删除远程开发分支
   * @author by hapinesszj
   */
  async _deleteRemoteBranch() {
    log.info('开始删除远程分支', this.branch);
    await this.git.push(['origin', '--delete', this.branch]);
    log.success('删除远程分支成功', this.branch);
  }

  /**
   * @description 检查代码冲突
   * @author by hapinesszj
   */
  async _checkConflicted() {
    log.info('代码冲突检查');
    const status = await this.git.status();
    if (status.conflicted.length > 0) {
      throw new Error('当前代码存在冲突，请手动处理合并后再试！');
    }
    log.success('代码冲突检查通过');
  }

  /**
   * @description 检查未提交代码
   * @author by hapinesszj
   */
  async _checkNotCommitted() {
    const status = await this.git.status();
    if (status.not_added.length > 0 || status.created.length > 0 || status.deleted.length > 0 || status.modified.length > 0 || status.renamed.length > 0) {
      log.verbose('status', status);
      await this.git.add(status.not_added);
      await this.git.add(status.created);
      await this.git.add(status.deleted);
      await this.git.add(status.modified);
      await this.git.add(status.renamed);
      let message;
      while (!message) {
        message = (
          await inquirer.prompt({
            type: 'text',
            name: 'message',
            message: '请输入commit信息：',
          })
        ).message;
      }
      await this.git.commit(message);
      log.success('本次commit提交成功');
    }
  }

  /**
   * @description 检查缓存区
   * @author by hapinesszj
   */
  async _checkStash() {
    log.info('检查stash记录');
    const stashList = await this.git.stashList();
    if (stashList.all.length > 0) {
      await this.git.stash(['pop']);
      log.success('stash pop成功');
    }
  }

  /**
   * @description 获取PackageJson
   * @author by hapinesszj
   */
  _getPackageJson() {
    const pkgPath = path.resolve(this.dir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      throw new Error(`package.json 不存在！源码目录：${this.dir}`);
    }
    return fse.readJsonSync(pkgPath);
  }

  /**
   * @description 检查是否有主分支
   * @author by hapinesszj
   */
  async _checkRemoteMain() {
    return (await this.git.listRemote(['--refs'])).indexOf('refs/heads/main') >= 0;
  }

  /**
   * @description 生成开发分支
   * @author by hapinesszj
   */
  async _getCorrectVersion() {
    log.info('获取版本分支');
    const remoteBranchList = await this._getRemoteBranchList(VERSION_RELEASE);

    let releaseVersion = null;
    if (remoteBranchList && remoteBranchList.length > 0) {
      releaseVersion = remoteBranchList[0];
    }
    log.verbose('线上最新版本号', releaseVersion);

    const devVersion = this.version;
    if (!releaseVersion) {
      this.branch = `${VERSION_DEVELOP}/${devVersion}`;
    } else if (semver.gt(this.version, releaseVersion)) {
      log.info('当前版本大于线上最新版本', `${devVersion} >= ${releaseVersion}`);
      this.branch = `${VERSION_DEVELOP}/${devVersion}`;
    } else {
      log.info('当前线上版本大于本地版本', `${releaseVersion} > ${devVersion}`);
      const incType = (
        await inquirer.prompt({
          type: 'list',
          name: 'incType',
          message: '自动升级版本，请选择升级版本类型',
          default: 'patch',
          choices: [
            {
              name: `小版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'patch')}）`,
              value: 'patch',
            },
            {
              name: `中版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'minor')}）`,
              value: 'minor',
            },
            {
              name: `大版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'major')}）`,
              value: 'major',
            },
          ],
        })
      ).incType;

      const incVersion = semver.inc(releaseVersion, incType);
      this.branch = `${VERSION_DEVELOP}/${incVersion}`;
      this.version = incVersion;

      log.verbose('本地开发分支', this.branch);
      this._syncVersionToPackageJson();
    }
  }

  /**
   * @description 切换分支
   * @param {string} branch
   * @author by hapinesszj
   */
  async _checkoutBranch(branch) {
    const localBranchList = await this.git.branchLocal();
    if (localBranchList.all.indexOf(branch) >= 0) {
      await this.git.checkout(branch);
    } else {
      await this.git.checkoutLocalBranch(branch);
    }
    log.success(`分支切换到${branch}`);
  }

  /**
   * @description 同步远程分支
   * @param {string} branchName
   * @param {object} options
   * @author by hapinesszj
   */
  async _pullRemoteRepo(branchName, options) {
    log.info(`同步远程${branchName}分支代码`);
    await this.git.pull('origin', branchName, options).catch((err) => {
      log.error(err.message);
    });
  }

  /**
   * @description 合并远程main分支和开发分支代码
   * @author by hapinesszj
   */
  async _pullRemoteMainAndBranch() {
    log.info(`合并远程[main]分支 -> 本地[${this.branch}]分支开始`);
    await this._pullRemoteRepo('main');
    log.success(`合并远程[main]分支 -> 本地[${this.branch}]分支成功`);
    await this._checkConflicted();
    log.info('检查远程开发分支');
    const remoteBranchList = await this._getRemoteBranchList();
    if (remoteBranchList.indexOf(this.version) >= 0) {
      log.info(`合并远程[${this.branch}]分支 -> 本地[${this.branch}]分支开始`);
      await this._pullRemoteRepo(this.branch);
      log.success(`合并远程[${this.branch}]分支 -> 本地[${this.branch}]分支成功`);
      await this._checkConflicted();
    } else {
      log.success(`不存在远程分支 [${this.branch}]`);
    }
  }

  /**
   * @description 推送代码到远程分支
   * @param {string} branchName
   * @author by hapinesszj
   */
  async _pushRemoteRepo(branchName) {
    log.info(`推送代码至${branchName}分支`);
    await this.git.push('origin', branchName);
    log.success('推送代码成功');
  }

  /**
   * @description 获取远程分支集合
   * @param {string} type
   * @author by hapinesszj
   */
  async _getRemoteBranchList(type) {
    const remoteList = await this.git.listRemote(['--refs']);
    let reg;
    if (type === VERSION_RELEASE) {
      reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g;
    } else {
      reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g;
    }
    return remoteList
      .split('\n')
      .map((remote) => {
        const match = reg.exec(remote);
        reg.lastIndex = 0;
        if (match && semver.valid(match[1])) {
          return match[1];
        }
      })
      .filter((_) => _)
      .sort((a, b) => {
        if (semver.lte(b, a)) {
          if (a === b) return 0;
          return -1;
        }
        return 1;
      });
  }

  /**
   * @description version同步package
   * @author by hapinesszj
   */
  _syncVersionToPackageJson() {
    const pkg = fse.readJsonSync(`${this.dir}/package.json`);
    if (pkg && pkg.version !== this.version) {
      pkg.version = this.version;
      fse.writeJsonSync(`${this.dir}/package.json`, pkg, {spaces: 2});
    }
  }

  /**
   * @description 检查用户主目录
   * @author by hapinesszj
   */
  _checkHomePath() {
    if (!this.homePath) {
      if (process.env.CLI_HOME_PATH) {
        this.homePath = process.env.CLI_HOME_PATH;
      } else {
        this.homePath = path.resolve(userHome, DEFAULT_CLI_HOME);
      }
    }
    log.verbose('home', this.homePath);
    fse.ensureDirSync(this.homePath);
    if (!fs.existsSync(this.homePath)) {
      throw new Error('用户主目录获取失败！');
    }
  }

  /**
   * @description 检查用户远程仓库类型
   * @author by hapinesszj
   */
  async _checkGitServer() {
    const gitServerPath = this._createGitPath(GIT_SERVER_FILE);
    let gitServer = readFile(gitServerPath);
    if (!gitServer || this.refreshServer) {
      gitServer = (
        await inquirer.prompt({
          type: 'list',
          name: 'gitServer',
          message: '请选择您想要托管的Git平台',
          default: GITHUB,
          choices: GIT_SERVER_TYPE,
        })
      ).gitServer;
      writeFile(gitServerPath, gitServer);
      log.success('git server写入成功', `${gitServer} -> ${gitServerPath}`);
    } else {
      log.success('git server获取成功', gitServer);
    }
    this.gitType = gitServer;
    this.gitServer = this._createGitServer(gitServer);
    if (!this.gitServer) {
      throw new Error('GitServer初始化失败！');
    }
  }

  /**
   * @description 检查是否获取远程仓库Token
   * @author by hapinesszj
   */
  async _checkGitToken() {
    const tokenPath = this._createGitPath(GIT_TOKEN_FILE);
    let token = readFile(tokenPath);
    if (!token || this.refreshToken) {
      log.warn(this.gitServer.type + ' token未生成', '请先生成' + this.gitServer.type + ' token，' + terminalLink('链接', this.gitServer.getTokenUrl()));
      token = (
        await inquirer.prompt({
          type: 'password',
          name: 'token',
          message: '请将token复制到这里',
          default: '',
        })
      ).token;
      writeFile(tokenPath, token);
      log.success('token写入成功', `${token} -> ${tokenPath}`);
    } else {
      log.success('token获取成功', tokenPath);
    }
    this.gitServer.setToken(token);
  }

  /**
   * @description 获取远程仓库用户和组织信息
   * @author by hapinesszj
   */
  async _getUserAndOrgs() {
    this.user = await this.gitServer.getUser();

    if (!this.user) {
      throw new Error('用户信息获取失败！');
    }
    log.verbose('user', this.user);
    this.orgs = await this.gitServer.getOrg(this.user.login);
    if (!this.orgs) {
      throw new Error('组织信息获取失败！');
    }
    log.verbose('orgs', this.orgs);
    log.success(this.gitServer.type + ' 用户和组织信息获取成功');
  }

  /**
   * @description 确认远程仓库类型（个人/组织）
   * @author by hapinesszj
   */
  async _checkGitOwner() {
    const ownerPath = this._createGitPath(GIT_OWN_FILE);
    const loginPath = this._createGitPath(GIT_LOGIN_FILE);
    let owner = readFile(ownerPath);
    let login = readFile(loginPath);
    if (!owner || !login || this.refreshOwner) {
      owner = (
        await inquirer.prompt({
          type: 'list',
          name: 'owner',
          message: '请选择远程仓库类型',
          default: REPO_OWNER_USER,
          choices: this.orgs.length > 0 ? GIT_OWNER_TYPE : GIT_OWNER_TYPE_ONLY,
        })
      ).owner;
      if (owner === REPO_OWNER_USER) {
        login = this.user.login;
      } else {
        login = (
          await inquirer.prompt({
            type: 'list',
            name: 'login',
            message: '请选择',
            choices: this.orgs.map((item) => ({
              name: item.login,
              value: item.login,
            })),
          })
        ).login;
      }
      writeFile(ownerPath, owner);
      writeFile(loginPath, login);
      log.success('owner写入成功', `${owner} -> ${ownerPath}`);
      log.success('login写入成功', `${login} -> ${loginPath}`);
    } else {
      log.success('owner获取成功', owner);
      log.success('login获取成功', login);
    }
    this.owner = owner;
    this.login = login;
  }

  /**
   * @description 检查并创建.gitignore文件
   * @author by hapinesszj
   */
  _checkGitIgnore() {
    const gitIgnore = path.resolve(this.dir, GIT_IGNORE_FILE);
    if (!fs.existsSync(gitIgnore)) {
      writeFile(
        gitIgnore,
        `.DS_Store
node_modules
/dist


# local env files
.env.local
.env.*.local

# Log files
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Editor directories and files
.idea
.vscode
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`
      );
      log.success(`自动写入${GIT_IGNORE_FILE}文件成功`);
    }
  }

  /**
   * @description 获取远程仓库地址
   * @author by hapinesszj
   */
  _getRemote() {
    const gitPath = path.resolve(this.dir, GIT_ROOT_DIR);
    this.remote = this.gitServer.getRemote(this.login, this.name);
    if (fs.existsSync(gitPath)) {
      log.success('git已完成初始化');
      return true;
    }
  }

  /**
   * @description 创建git托管平台
   * @param {string} gitServer
   * @author by hapinesszj
   */
  _createGitServer(gitServer = '') {
    if (gitServer === GITHUB) {
      return new Github();
    } else if (gitServer === GITEE) {
      return new Gitee();
    }
    return null;
  }

  /**
   * @description 创建git系列文件
   * @param {string} file
   * @author by hapinesszj
   */
  _createGitPath(file) {
    const rootDir = path.resolve(this.homePath, GIT_ROOT_DIR);
    const filePath = path.resolve(rootDir, file);
    fse.ensureDirSync(rootDir);
    return filePath;
  }
}

module.exports = Git;
