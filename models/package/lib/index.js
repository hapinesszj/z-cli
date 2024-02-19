'use strict';

const path = require('path');
const fse = require('fs-extra');
const pkgDir = require('pkg-dir').sync;
const pathExists = require('path-exists').sync;
const npminstall = require('npminstall');
const {isObject, formatPath, throwError} = require('@byte-sculpt/tools');
const {getDefaultRegistry, getNpmLatestVersion} = require('@byte-sculpt/npm');

class Package {
  /**
   * @description npm 包类构造器
   * @param {object} options
   * @author by hapinesszj
   */
  constructor(options) {
    if (!options) {
      throwError('Package类的options参数不能为空！');
    }
    if (!isObject(options)) {
      throwError('Package类的options参数必须为对象！');
    }

    const {targetPath, storeDir, packageName, packageVersion} = options;

    this.targetPath = targetPath; //package的目标路径
    this.storeDir = storeDir; //缓存package的路径
    this.packageName = packageName; //package的name
    this.packageVersion = packageVersion; //package的version
    this.cacheFilePathPrefix = this.packageName.replace('/', '_'); //package的缓存目录前缀
  }

  /**
   * @description 模块缓存路径
   * @readonly
   * @returns string
   * @memberof Package
   * @author by hapinesszj
   */
  get cacheFilePath() {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`);
  }

  /**
   * @description 指定版本号模块缓存路径
   * @param {string} packageVersion
   * @author by hapinesszj
   */
  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`);
  }

  /**
   * @description 执行预检查
   * @author by hapinesszj
   */
  async prepare() {
    if (this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirpSync(this.storeDir);
    }

    // 默认获取设置最新的npm模块版本号
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLatestVersion(this.packageName);
    }
  }

  /**
   * @description 是否存在Package
   * @author by hapinesszj
   */
  async exists() {
    if (this.storeDir) {
      await this.prepare();
      return pathExists(this.cacheFilePath);
    } else {
      return pathExists(this.targetPath);
    }
  }

  /**
   * @description 安装Package
   * @author by hapinesszj
   */
  async install() {
    await this.prepare();
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(false),
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion,
        },
      ],
    });
  }

  /**
   * @description 更新Package
   * @author by hapinesszj
   */
  async update() {
    await this.prepare();
    const latestPackageVersion = await getNpmLatestVersion(this.packageName); //获取最新的npm模块版本号
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion); //最新版本号对应的路径

    // 如果最新版本号对应的路径不存在，则安装最新版本
    if (!pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(false),
        pkgs: [
          {
            name: this.packageName,
            version: latestPackageVersion,
          },
        ],
      });
      this.packageVersion = latestPackageVersion;
    } else {
      this.packageVersion = latestPackageVersion;
    }
  }

  /**
   * @description 获取入口文件
   * @author by hapinesszj
   */
  getEntryFilePath() {
    function _getRootFile(targetPath) {
      const dir = pkgDir(targetPath);
      if (dir) {
        const pkgFile = require(path.resolve(dir, 'package.json'));
        if (pkgFile && pkgFile.main) {
          return formatPath(path.resolve(dir, pkgFile.main));
        }
      }
      return null;
    }

    if (this.storeDir) {
      return _getRootFile(this.cacheFilePath);
    } else {
      return _getRootFile(this.targetPath);
    }
  }
}

module.exports = Package;
