'use strict';

var Devebot = require('devebot');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');

var Service = function(params) {
  params = params || {};

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();
  var packageName = params.packageName || 'app-wsforwarder';
  var blockRef = chores.getBlockRef(__filename, packageName);

  var pluginCfg = lodash.get(params, 'sandboxConfig', {});

  var mappings = {};
  
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

module.exports = Service;
