#! /usr/bin/env node

const importLocal = require('import-local');
if (importLocal(__filename)) return;

require('../lib')(process.argv.slice(2));
