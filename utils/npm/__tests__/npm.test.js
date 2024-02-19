'use strict';

const npm = require('..');
const assert = require('assert').strict;

assert.strictEqual(npm(), 'Hello from npm');
console.info('npm tests passed');
