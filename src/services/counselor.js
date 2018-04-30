'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');

function Counselor(params) {
  params = params || {};

  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-wsforwarder';
  let blockRef = chores.getBlockRef(__filename, packageName);

  let pluginCfg = lodash.get(params, 'sandboxConfig', {});

  let mappings = {};
  
  if (pluginCfg.mappingStore) {
    lodash.merge(mappings, require(pluginCfg.mappingStore));
  }

  if (pluginCfg.mappings) {
    lodash.merge(mappings, pluginCfg.mappings);
  }

  this.has = function(eventName) {
    return lodash.isObject(mappings[eventName]);
  }

  this.get = function(eventName) {
    return mappings[eventName];
  }
}

module.exports = Counselor;
