// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var authorization = require('./authorization.js');
var endpoint = require('./endpoint.js');
var Message = require('./message.js');

function anHourFromNow () {
  var raw = (Date.now() / 1000) + 3600;
  return Math.ceil(raw);
}

function constructBatchBody(messages)
{
  var body = '[';

  messages.forEach(function(message, index) {
    var buffMsg = new Buffer(message.getData() );

    if (index > 0) body += ',';

    body += '{\"body\":\"'+buffMsg.toString('base64')+'\"';
    // Get the properties
    var propertyIdx = 0;
    var property = ',\"properties\":{';
    for (propertyIdx = 0; propertyIdx < message.properties.count(); propertyIdx++) {
      if (propertyIdx > 0)
        property += ',';
      var propItem = message.properties.getItem(propertyIdx);
      property += '\"'+propItem.key+'\":\"'+propItem.value+'\"';
    }
    if (propertyIdx > 0) {
      property += '}';
      body += property;
    }
    body += "}";
  });
  body += ']';
  return body;
}

/**
 * @class Https
 * @classdesc Constructs an {@linkcode Https} object.
 */
/*Codes_SRS_NODE_IOTHUB_HTTPS_05_001: [The Https constructor shall accept a config object with three properties:
host – (string) the fully-qualified DNS hostname of an IoT Hub
keyName – (string) the identifier of a device registered with the IoT Hub, or the name of an authorization policy
key – (string) the key associated with the device registration or authorization policy.]*/
function Https() {
  var https = require('https');

  this.buildFeedbackRequest = function (method, path, lockToken, config, done) {
    var token = new authorization.DeviceToken(config.host, config.keyName, config.key, anHourFromNow());

    var httpHeaders = {
      'Authorization': token.toString(),
      'If-Match': lockToken
    };
    var options = {
      host: config.host,
      path: path,
      method: method,
      headers: httpHeaders
    };

    var request = https.request(options, function (response) {
      var responseBody = '';
      response.on('data', function (chunk) {
        responseBody += chunk;
      });
      response.on('end', function () {
        var err = (response.statusCode >= 300) ?
          new Error(response.statusMessage) :
          null;
        done(err, response);
      });
    });

    /* Codes_SRS_NODE_IOTHUB_HTTPS_07_004: [If sendFeedback encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message)] */
    request.on('error', done);
    return request;
  };

  this.buildRequest = function (method, path, httpHeaders, config, done) {
    var options = {
      host: config.host,
      path: path + '?api-version=2015-08-15-preview',
      method: method,
      headers: httpHeaders
    };

    var request = https.request(options, function onResponse(response) {
      var responseBody = '';
      response.on('data', function onResponseData(chunk) {
        responseBody += chunk;
      });
      response.on('end', function onResponseEnd() {
        var msg;
        // Save good responses only
        if (response.statusCode < 300) {
          msg = new Message(responseBody);
          // Go through the response header
          for(var item in response.headers) {
            if (item.search("iothub-") !== -1) {
              if (item.toLowerCase() === "iothub-messageid") {
                msg.messageId = response.headers[item];
              }
              else if (item.toLowerCase() === "iothub-to") {
                msg.to = response.headers[item];
              }
              else if (item.toLowerCase() === "iothub-expiry") {
                msg.expiryTimeUtc = response.headers[item];
              }
              else if (item.toLowerCase() === "iothub-correlationid") {
                msg.correlationId = response.headers[item];
              }
            }
            else if (item.toLowerCase() === "etag") {
              // Need to strip the quotes from the string
              var len = response.headers[item].length;
              msg.lockToken = response.headers[item].substring(1, len-1);
            }
          }
        }
        /*Codes_SRS_NODE_IOTHUB_HTTPS_05_004: [When sendEvent receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
        err - the standard JavaScript Error object
        res - the Node.js http.ServerResponse object returned by the transport]*/
        /*Codes_SRS_NODE_IOTHUB_HTTPS_05_008: [When receive receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
        err - the standard JavaScript Error object
        res - the Node.js http.ServerResponse object returned by the transport]*/
        /*SRS_NODE_IOTHUB_HTTPS_05_012: [When getDevice receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
        err - the standard JavaScript Error object
        res - the Node.js http.ServerResponse object returned by the transport]*/
        /*Codes_SRS_NODE_IOTHUB_HTTPS_05_005: [When sendEvent receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
        err - null
        res - the Node.js http.ServerResponse object returned by the transport]*/
        /*Codes_SRS_NODE_IOTHUB_HTTPS_05_009: [When receive receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
        err - null
        res - the Node.js http.ServerResponse object returned by the transport
        msg – the response body, i.e. the content of the message received from IoT Hub, as an iothub.Message object]*/
        /*Codes_SRS_NODE_IOTHUB_HTTPS_05_013: [When getDevice receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
        err - null
        res - the Node.js http.ServerResponse object returned by the transport
        msg – the response body, i.e. metadata representing the device, as an iothub.Message object]*/
        /*Codes_SRS_NODE_IOTHUB_HTTPS_05_013: [When getDevice receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
        err - null
        res - the Node.js http.ServerResponse object returned by the transport
        msg - the response body, i.e. metadata representing the device, as an iothub.Message object]*/
        /*Codes_SRS_NODE_IOTHUB_HTTPS_07_008: [When sendEventBatch receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
        err - null
        res - the Node.js http.ServerResponse object returned by the transport]*/
        /*Codes_SRS_NODE_IOTHUB_HTTPS_07_009: [When sendEventBatch receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
        err - the standard JavaScript Error object
        res - the Node.js http.ServerResponse object returned by the transport]*/
        var err = (response.statusCode >= 300) ?
          new Error(response.statusMessage) :
          null;
        done(err, response, msg);
      });
    });

    /*Codes_SRS_NODE_IOTHUB_HTTPS_05_003: [If sendEvent encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message).]*/
    /*Codes_SRS_NODE_IOTHUB_HTTPS_05_007: [If receive encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message).]*/
    /*Codes_SRS_NODE_IOTHUB_HTTPS_05_011: [If getDevice encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message).]*/
    /*Codes_SRS_NODE_IOTHUB_HTTPS_07_007: [If sendEventBatch encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message).*/
    request.on('error', done);
    return request;
  };
}

/**
 * This method sends an event to the IoT Hub as the device indicated in the
 * `config` parameter.
 * @param {Message}  message    The [message]{@linkcode module:common/message.Message}
 *                              to be sent.
 * @param {Object}  config      This is a dictionary containing the following keys
 *                              and values:
 *
 * | Key     | Value                                                   |
 * |---------|---------------------------------------------------------|
 * | host    | The host URL of the Azure IoT Hub                       |
 * | hubName | The name of the Azure IoT Hub                           |
 * | keyName | The identifier of the device that is being connected to |
 * | key     | The shared access key auth                              |
 *
 * @param {Function} done       The callback to be invoked when `sendEvent`
 *                              completes execution.
 */
Https.prototype.sendEvent = function (message, config, done) {
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_002: [The sendEvent method shall construct an HTTP request using information supplied by the caller, as follows:
    POST <config.host>/devices/<config.keyName>/messages/events?api-version=<version> HTTP/1.1
    Authorization: <token generated from config>
    iothub-to: /devices/<config.keyName>/messages/events
  Host: <config.host>

  <message>
  ]*/
  var path = endpoint.eventPath(config.keyName);
  var token = new authorization.DeviceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
    'Authorization': token.toString(),
    'iothub-to': path
  };
  for (var i = 0; i < message.properties.count(); i++) {
    var propItem = message.properties.getItem(i);
    httpHeaders[propItem.key] = propItem.value;
  }
  var request = this.buildRequest('POST', path, httpHeaders, config, done);
  request.write(message.getBytes() );
  request.end();
};

/**
 * The `sendEventBatch` method sends a list of event messages to the IoT Hub
 * as the device indicated in the `config` parameter.
 * @param {array<Message>} messages   Array of [Message]{@linkcode module:common/message.Message}
 *                                    objects to be sent as a batch.
 * @param {Object}  config            This is a dictionary containing the
 *                                    following keys and values:
 *
 * | Key     | Value                                                   |
 * |---------|---------------------------------------------------------|
 * | host    | The host URL of the Azure IoT Hub                       |
 * | hubName | The name of the Azure IoT Hub                           |
 * | keyName | The identifier of the device that is being connected to |
 * | key     | The shared access key auth                              |
 *
 * @param {Function}      done      The callback to be invoked when
 *                                  `sendEventBatch` completes execution.
 */
Https.prototype.sendEventBatch = function (messages, config, done) {
  /* Codes_SRS_NODE_IOTHUB_HTTPS_07_006: [The sendEventBatch method shall construct an HTTP request using information supplied by the caller, as follows:
  POST <config.host>/devices/<config.keyName>/messages/events?api-version=<version> HTTP/1.1
  Authorization: <token generated from config>
  iothub-to: /devices/<config.keyName>/messages/events
  Content-Type: ‘application/vnd.microsoft.iothub.json’
  Host: <config.host>

  {“body”:”<Base64 Message1>”,”properties”:{“<key>”:”<value”}},{ “body”:<Base64 Message1>”}…]*/
  var path = endpoint.eventPath(config.keyName);
  var token = new authorization.DeviceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
    'Authorization': token.toString(),
    'iothub-to': path,
    'Content-Type': 'application/vnd.microsoft.iothub.json'
  };

  var request = this.buildRequest('POST', path, httpHeaders, config, done);
  var body = constructBatchBody(messages);
  request.write(body);
  request.end();
};

/**
 * The receive method queries the IoT Hub (as the device indicated in the
 * `config` parameter) for the next message in the queue.
 * @param {Object}  config            This is a dictionary containing the
 *                                    following keys and values:
 *
 * | Key     | Value                                                   |
 * |---------|---------------------------------------------------------|
 * | host    | The host URL of the Azure IoT Hub                       |
 * | hubName | The name of the Azure IoT Hub                           |
 * | keyName | The identifier of the device that is being connected to |
 * | key     | The shared access key auth                              |
 *
 * @param {Function}      done      The callback to be invoked when
 *                                  `receive` completes execution.
 */
Https.prototype.receive = function (config, done) {
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_006: [The receive method shall construct an HTTP request using information supplied by the caller, as follows:
  GET <config.host>/devices/<config.keyName>/messages/devicebound?api-version=<version> HTTP/1.1
  Authorization: <token generated from config>
  iothub-to: /devices/<config.keyName>/messages/devicebound
  Host: <config.host>
  ]*/
  var path = endpoint.messagePath(config.keyName);
  var token = new authorization.DeviceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
    'Authorization': token.toString(),
    'iothub-to': path
  };
  var request = this.buildRequest('GET', path, httpHeaders, config, done);
  request.end();
};

/**
 * This method sends the feedback action to the IoT Hub.
 *
 * @param {String}  action    This parameter must be equal to one of the
 *                            following possible values:
 *
 * | Value    | Action                                                                                               |
 * |----------|------------------------------------------------------------------------------------------------------|
 * | abandon  | Directs the IoT Hub to re-enqueue a message so it may be received again later.          |
 * | reject   | Directs the IoT Hub to delete a message from the queue and record that it was rejected. |
 * | complete | Directs the IoT Hub to delete a message from the queue and record that it was accepted. |
 *
 * @param {String}  lockToken An HTTP E-Tag used to manage concurrent updates
 *                            to the device
 * @param {Object}  config    This is a dictionary containing the
 *                            following keys and values:
 *
 * | Key     | Value                                                   |
 * |---------|---------------------------------------------------------|
 * | host    | The host URL of the Azure IoT Hub                       |
 * | hubName | The name of the Azure IoT Hub                           |
 * | keyName | The identifier of the device that is being connected to |
 * | key     | The shared access key auth                              |
 * @param {Function}      done      The callback to be invoked when
 *                                  `sendFeedback` completes execution.
 */
Https.prototype.sendFeedback = function (action, lockToken, config, done) {
  var path = endpoint.feedbackPath(config.keyName, lockToken);
  var method = '';

  /* Codes_SRS_NODE_IOTHUB_HTTPS_07_005: [The sendFeedback method shall verify the lockToken and shall call done with an error.] */
  if (lockToken === '') {
    done(new Error('Invalid lockToken') );
  }
  else{
    /* Codes_SRS_NODE_IOTHUB_HTTPS_07_001: [On abandon sendFeedback will send a POST message with the following path PATH + lockToken + ‘/abandon?api-version=2015-08-15-preview’] */
    if (action === 'abandon') {
      path += "/abandon?api-version=2015-08-15-preview";
      method = 'POST';
    }
    /* Codes_SRS_NODE_IOTHUB_HTTPS_07_002: [On reject the sendFeedback method will send a DELETE message with the following path PATH + lockToken + ‘?api-version=2015-08-15-preview&reject’] */
    else if (action === 'reject') {
      path += "?api-version=2015-08-15-preview&reject";
      method = 'DELETE';
    }
    /* Codes_SRS_NODE_IOTHUB_HTTPS_07_003: [On complete the sendFeedback method will send a DELETE message with the following path PATH + lockToken + ‘api-version=2015-08-15-preview’] */
    else {
      path += "?api-version=2015-08-15-preview";
      method = 'DELETE';
    }

    var request = this.buildFeedbackRequest(method, path, lockToken, config, done);
    request.end();
  }
};

Https.prototype.createDevice = function (path, deviceInfo, config, done) {
  /* SRS_NODE_IOTHUB_HTTPS_07_010: [The device methods shall construct an HTTP request using information supplied by the caller, as follows:
  OPERATION <path>?api-version=<version> HTTP/1.1
  Authorization: <token generated from config>
  iothub-name: config.hubname
  Content-Type: 'application/json; charset=utf-8'
  Host: <config.host>]
  */
  var token = new authorization.ServiceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
    'Authorization': token.toString(),
    'iothub-name': config.hubName,
    'Content-Type': 'application/json; charset=utf-8'
  };
  /*SRS_NODE_IOTHUB_HTTPS_07_012: [When device methods receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
  err - the standard JavaScript Error object
  res - the Node.js http.ServerResponse object returned by the transport]
  SRS_NODE_IOTHUB_HTTPS_07_013: [When device methods receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
  err - null
  res - the Node.js http.ServerResponse object returned by the transport
  msg - the response body, i.e. metadata representing the device, as an iothub.Message object]*/
  var request = this.buildRequest('PUT', path, httpHeaders, config, done);
  request.write(JSON.stringify(deviceInfo));
  request.end();
};

Https.prototype.updateDevice = function (path, deviceInfo, config, done) {
  /* SRS_NODE_IOTHUB_HTTPS_07_010: [The device methods shall construct an HTTP request using information supplied by the caller, as follows:
  OPERATION <path>?api-version=<version> HTTP/1.1
  Authorization: <token generated from config>
  iothub-name: config.hubname
  Content-Type: 'application/json; charset=utf-8'
  Host: <config.host>]
  */
  var token = new authorization.ServiceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
    'Authorization': token.toString(),
    'iothub-name': config.hubName,
    'Content-Type': 'application/json; charset=utf-8',
    'If-Match': '*'
  };
  /*SRS_NODE_IOTHUB_HTTPS_07_012: [When device methods receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
  err - the standard JavaScript Error object
  res - the Node.js http.ServerResponse object returned by the transport]
  SRS_NODE_IOTHUB_HTTPS_07_013: [When device methods receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
  err - null
  res - the Node.js http.ServerResponse object returned by the transport
  msg - the response body, i.e. metadata representing the device, as an iothub.Message object]*/
  var request = this.buildRequest('PUT', path, httpHeaders, config, done);
  request.write(JSON.stringify(deviceInfo));
  request.end();
};

Https.prototype.getDevice = function (path, config, done) {
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_010: [The device methods shall construct an HTTP request using information supplied by the caller, as follows:
  OPERATION <path>?api-version=<version> HTTP/1.1
  Authorization: <token generated from config>
  iothub-name: config.hubname
  Host: <config.host>
  ]*/
  var token = new authorization.ServiceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
      'Authorization': token.toString(),
      'iothub-name': config.hubName,
  };
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_011: [If device methods encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message).]*/
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_012: [When device methods receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
  err - the standard JavaScript Error object
  res - the Node.js http.ServerResponse object returned by the transport]*/
  /* Codes_SRS_NODE_IOTHUB_HTTPS_05_013: [When device methods receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
  err - null
  res - the Node.js http.ServerResponse object returned by the transport
  msg - the response body, i.e. metadata representing the device, as an iothub.Message object]*/
  var request = this.buildRequest('GET', path, httpHeaders, config, done);
  request.end();
};

Https.prototype.listDevice = function (path, config, done) {
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_010: [The device methods shall construct an HTTP request using information supplied by the caller, as follows:
  OPERATION <path>?api-version=<version> HTTP/1.1
  Authorization: <token generated from config>
  iothub-name: config.hubname
  Host: <config.host>
  ]*/
  var token = new authorization.ServiceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
      'Authorization': token.toString(),
      'iothub-name': config.hubName,
  };
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_011: [If device methods encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message).]*/
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_012: [When device methods receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
  err - the standard JavaScript Error object
  res - the Node.js http.ServerResponse object returned by the transport]*/
  /* Codes_SRS_NODE_IOTHUB_HTTPS_05_013: [When device methods receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
  err - null
  res - the Node.js http.ServerResponse object returned by the transport
  msg - the response body, i.e. metadata representing the device, as an iothub.Message object]*/
  var request = this.buildRequest('GET', path, httpHeaders, config, done);
  request.end();
};

Https.prototype.deleteDevice = function (path, config, done) {
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_010: [The device methods shall construct an HTTP request using information supplied by the caller, as follows:
  OPERATION <path>?api-version=<version> HTTP/1.1
  Authorization: <token generated from config>
  iothub-name: config.hubname
  Host: <config.host>
  ]*/
  var token = new authorization.ServiceToken(config.host, config.keyName, config.key, anHourFromNow());
  var httpHeaders = {
      'Authorization': token.toString(),
      'iothub-name': config.hubName,
      'If-Match': '*'
  };
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_011: [If device methods encounters an error before it can send the request, it shall invoke the done callback function and pass the standard JavaScript Error object with a text description of the error (err.message).]*/
  /*Codes_SRS_NODE_IOTHUB_HTTPS_05_012: [When device methods receives an HTTP response with a status code >= 300, it shall invoke the done callback function with the following arguments:
  err - the standard JavaScript Error object
  res - the Node.js http.ServerResponse object returned by the transport]*/
  /* Codes_SRS_NODE_IOTHUB_HTTPS_05_013: [When device methods receives an HTTP response with a status code < 300, it shall invoke the done callback function with the following arguments:
  err - null
  res - the Node.js http.ServerResponse object returned by the transport
  msg - the response body, i.e. metadata representing the device, as an iothub.Message object]*/
  var request = this.buildRequest('DELETE', path, httpHeaders, config, done);
  request.end();
};

module.exports = Https;
