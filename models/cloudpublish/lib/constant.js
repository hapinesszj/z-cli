const WS_SERVER = 'http://www.hapinesszj.cn:7002/io';
const TIME_OUT = 5 * 60 * 1000;
const CONNECT_TIME_OUT = 5 * 1000;

const FAILED_CODE = ['prepare failed', 'download failed', 'install failed', 'build failed', 'pre-publish failed', 'publish failed'];

module.exports = {
  WS_SERVER,
  TIME_OUT,
  CONNECT_TIME_OUT,
  FAILED_CODE,
};
