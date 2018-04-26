'use strict';

var Devebot = require('devebot');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var locks = require('locks');

var Service = function(params) {
  params = params || {};

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();
  var packageName = params.packageName || 'app-wsforwarder';
  var blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  var counselor = params.counselor;
  var sandboxRegistry = params["devebot/sandboxRegistry"];
  var websocketTrigger = params["app-websocket/websocketTrigger"];

  var lookupMethod = function(serviceName, methodName) {
    var ref = {};
    var commander = sandboxRegistry.lookupService("app-opmaster/commander");
    if (commander) {
      ref.isRemote = true;
      ref.service = commander.lookupService(serviceName);
      if (ref.service) {
        ref.method = ref.service[methodName];
      }
    }
    if (!ref.method) {
      ref.isRemote = false;
      ref.service = sandboxRegistry.lookupService(serviceName);
      if (ref.service) {
        ref.method = ref.service[methodName];
      }
    }
    return ref;
  }

  /**
   * The forwarder method that contains:
   *  - this.socket: the socket object
   *  - this.tracer: the tracer associated with socket
   * 
   * @param {*} eventName name of received event
   * @param {*} eventData data in JSON
   * @param {*} next bypass the processing to the next interceptor
   */

  var forwarderInterceptor = function(eventName, eventData, next) {
    var that = this;
    var LT = this.tracer;
    LX.has('silly') && LX.log('silly', LT.add({
      eventName: eventName,
      eventData: eventData
    }).toMessage({
      text: 'Forwarder receives an event[${eventName}]: ${eventData}'
    }));

    if (counselor.has(eventName)) {
      var requestId = (eventData && eventData.requestId) || that.anchorId || LT.getLogID();
      var reqTR = LT.branch({ key: 'requestId', value: requestId });
      var mapping = counselor.get(eventName);
      var rpcData = mapping.transformRequest ? mapping.transformRequest(eventData) : eventData;
      var ref = lookupMethod(mapping.serviceName, mapping.methodName);
      var refMethod = ref && ref.method;
      if (lodash.isFunction(refMethod)) {
        var promize;
        if (ref.isRemote) {
          promize = refMethod(rpcData, {
            requestId: requestId,
            timeout: pluginCfg.opflowTimeout,
            opflowSeal: "on"
          });
        } else {
          promize = Promise.resolve().then(function() {
            return refMethod(rpcData, {
              requestId: requestId
            });
          });
        }
        return promize.then(function(result) {
          var replyTo = mapping.replyTo || eventName;
          that.socket.emit(replyTo, result);
          return true;
        }).catch(function(error) {
          var ename = lodash.get(pluginCfg, ['specialEvents', 'failed', 'name'], 'FAILED');
          that.socket.emit(ename, {
            status: -1,
            message: 'Service request has been failed',
            error: error
          });
          return true;
        });
      }
    }
    next();
  }

  var unmatchedInterceptor = function(eventName, eventData, next) {
    var errorEvent = lodash.get(pluginCfg, ['specialEvents', 'unmatched', 'name'], null);
    if (errorEvent) {
      LX.has('silly') && LX.log('silly', LT.add({
        eventName: eventName,
        eventData: eventData,
        errorEvent: errorEvent
      }).toMessage({
        tags: [ blockRef, 'unmatchedInterceptor' ],
        text: 'event[${eventName}] is reflected to ${errorEvent}'
      }));
      this.socket.emit(errorEvent, {name: eventName, data: eventData});
    } else {
      LX.has('error') && LX.log('error', LT.add({
        eventName: eventName,
        eventData: eventData,
        reason: 'not-found'
      }).toMessage({
        tags: [ blockRef, 'unmatchedInterceptor' ],
        text: 'event[${eventName}] with data: ${eventData} is unmatched'
      }))
    }
  }

  if (isTestingEnv()) {
    websocketTrigger.addInterceptor('__begin__', function(eventName, eventData, next) {
      LX.has('conlog') && LX.log('conlog', lodash.pad(this.socket.id, 70, '-'));
      next();
    });
  }

  websocketTrigger.addInterceptor('forwarder', forwarderInterceptor);

  if (isTestingEnv()) {
    websocketTrigger.addInterceptor('___end___', function(eventName, eventData, next) {
      LX.has('silly') && LX.log('silly', LT.add({
        eventName: eventName,
        eventData: eventData
      }).toMessage({
        tags: [ blockRef, 'echoInterceptor' ],
        text: 'ping/pong the event[${eventName}] with data: ${eventData}'
      }));
      this.socket.emit(eventName, eventData);
      LX.has('conlog') && LX.log('conlog', lodash.repeat('-', 70));
    });
  }

  websocketTrigger.addInterceptor('exception', unmatchedInterceptor);
}

Service.referenceList = [
  "counselor",
  "devebot/sandboxRegistry",
  "app-websocket/websocketTrigger"
];

module.exports = Service;

var isTestingEnv = function() {
  return process.env.NODE_ENV === 'test';
}
