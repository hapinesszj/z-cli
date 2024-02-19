const get = require('lodash/get');

/**
 * @description 提取信息字段
 * @param {string} msg
 * @returns {action, message}
 * @author by hapinesszj
 */
function parseMsg(msg) {
  const action = get(msg, 'data.action');
  const message = get(msg, 'data.payload.message');
  return {
    action,
    message,
  };
}

module.exports = {
  parseMsg,
};
