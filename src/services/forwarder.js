'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');

function Forwarder(params) {
  params = params || {};

  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-wsforwarder';
  let blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  let counselor = params.counselor;
  let sandboxRegistry = params["devebot/sandboxRegistry"];
  let websocketTrigger = params["app-websocket/websocketTrigger"];

  let lookupMethod = function(serviceName, methodName) {
    let ref = {};
    let commander = sandboxRegistry.lookupService("app-opmaster/commander");
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

  let forwarderInterceptor = function(eventName, eventData, next) {
    let that = this;
    let LT = this.tracer;
    LX.has('silly') && LX.log('silly', LT.add({
      eventName: eventName,
      eventData: eventData
    }).toMessage({
      text: 'Forwarder receives an event[${eventName}]: ${eventData}'
    }));

    if (counselor.has(eventName)) {
      let requestId = (eventData && eventData.requestId) || that.anchorId || LT.getLogID();
      let reqTR = LT.branch({ key: 'requestId', value: requestId });
      let mapping = counselor.get(eventName);
      let rpcData = mapping.transformRequest ? mapping.transformRequest(eventData) : eventData;
      let ref = lookupMethod(mapping.serviceName, mapping.methodName);
      let refMethod = ref && ref.method;
      if (lodash.isFunction(refMethod)) {
        let promize;
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
          let replyTo = mapping.replyTo || eventName;
          LX.has('debug') && LX.log('debug', LT.add({
            eventName: eventName,
            eventData: eventData,
            result: result,
            replyTo: replyTo
          }).toMessage({
            text: 'event[${eventName}] has done -> ${replyTo}: ${result}'
          }));
          that.socket.emit(replyTo, result);
          return result;
        }).catch(function(error) {
          let ename = lodash.get(pluginCfg, ['specialEvents', 'failed', 'name'], 'FAILED');
          LX.has('error') && LX.log('error', LT.add({
            eventName: eventName,
            eventData: eventData,
            error: error,
            replyTo: ename
          }).toMessage({
            text: 'event[${eventName}] has failed -> ${replyTo}: ${error}'
          }));
          that.socket.emit(ename, {
            status: -1,
            message: 'Service request has been failed',
            error: error
          });
          return error;
        });
      }
    }
    next();
  }

  let unmatchedInterceptor = function(eventName, eventData, next) {
    let errorEvent = lodash.get(pluginCfg, ['specialEvents', 'unmatched', 'name'], null);
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

Forwarder.referenceList = [
  "counselor",
  "devebot/sandboxRegistry",
  "app-websocket/websocketTrigger"
];

module.exports = Forwarder;

let isTestingEnv = function() {
  return process.env.NODE_ENV === 'test';
}
