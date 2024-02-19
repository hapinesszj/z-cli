'use strict';

const urlJoin = require('url-join');
const axios = require('axios');
const semver = require('semver');
const log = require('@byte-sculpt/log');
const {throwError} = require('@byte-sculpt/tools');

/**
 * @description 获取npm包信息
 * @param {string} npmName
 * @param {string} registry
 * @author by hapinesszj
 */
function getNpmInfo(npmName, registry) {
  if (!npmName) return null;
  const registryUrl = registry || getDefaultRegistry(false);
  const npmInfoUrl = urlJoin(registryUrl, npmName);

  return axios
    .get(npmInfoUrl)
    .then((response) => {
      if (response.status === 200) {
        return response.data;
      }
      return null;
    })
    .catch((err) => {
      const errObj = err.response.data;

      const errMessage = (errObj && errObj.error) || '获取npm包信息错误, 请稍后尝试～';
      return Promise.reject(errMessage);
    });
}

/**
 * @description 获取npm包所有版本号
 * @param {string} npmName
 * @param {string} registry
 * @author by hapinesszj
 */
async function getNpmVersions(npmName, registry) {
  try {
    const data = await getNpmInfo(npmName, registry);
    if (data) {
      return Object.keys(data.versions);
    } else {
      return [];
    }
  } catch (error) {
    throwError(error);
    // log.warn(error);
  }
}

/**
 * @description 获取npm包最新版本号
 * @param {string} npmName
 * @param {string} registry
 * @author by hapinesszj
 */
async function getNpmLatestVersion(npmName, registry) {
  let versions = await getNpmVersions(npmName, registry);
  if (versions) {
    return versions.sort((a, b) => semver.gt(b, a))[versions.length - 1];
  }
  return null;
}

/**
 * @description 获取npm包当前版本以及最新版本集合
 * @param {string} baseVersion
 * @param {string} npmName
 * @param {string} registry
 * @author by hapinesszj
 */
async function getNpmSemverVersion(baseVersion, npmName, registry) {
  function _getSemverVersions(baseVersion, versions) {
    return versions ? versions.filter((version) => semver.satisfies(version, `>${baseVersion}`)).sort((a, b) => (semver.gt(b, a) ? 1 : -1)) : [];
  }

  const versions = await getNpmVersions(npmName, registry);
  const newVersions = _getSemverVersions(baseVersion, versions);
  if (newVersions && newVersions.length > 0) {
    return newVersions[0];
  }
  return null;
}

/**
 * @description 获取默认源
 * @param {blooean} isOriginal
 * @author by hapinesszj
 */
function getDefaultRegistry(isOriginal = false) {
  return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npmmirror.com';
}

module.exports = {
  getDefaultRegistry,
  getNpmInfo,
  getNpmVersions,
  getNpmLatestVersion,
  getNpmSemverVersion,
};
