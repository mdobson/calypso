var usergrid = require('usergrid');
var compiler = require('./compiler');
var SessionConfig = require('../session_config');

var Session = module.exports = function(options) {
  options = options || {};

  this.org = options.org;
  this.app = options.app;

  this.config = null;
  this.client = null;
};

Session.prototype.init = function(config) {
  this.config = config;
  this.client = new usergrid.client({
    orgName: this.org,
    appName: this.app
  }); 
};

function convertToModel(config, entity, useConstructor) {
  if (useConstructor) {
    obj = Object.create(config.constructor.prototype);
    var keys = Object.keys(config.fieldMap);
    keys.forEach(function(key) {
      var prop = config.fieldMap[key] || key;
      obj[key] = entity[prop];
    });
  } else {
    obj = entity;
  }

  return obj;
}

Session.prototype.find = function(query, cb) {
  var config = query.modelConfig;

  var options = {
    type: config.collection,
    qs: { limit: 10 }
  };

  var fields;
  if (query) {
    var compilerOptions = {
      query: query,
      quoteStrings: true
    };

    var compiled = compiler().compile(compilerOptions);
    options.qs.ql = compiled.ql;
    fields = compiled.fields;
  }

  var options = {
    method: 'GET',
    endpoint: options.type,
    qs: options.qs
  };

  this.client.request(options, function(err, response) {
    var entities = [];

    if (response.list) {
      if (fields) {
        var obj = {};
        response.list.forEach(function(values) {
          fields.forEach(function(field, i) {
            obj[field] = values[i];
          });

          entities.push(convertToModel(config, obj));
        });
      }
    } else if(response.entities) {
      response.entities.forEach(function(entity) {
        var obj = convertToModel(config, entity, true);
        
        entities.push(obj);
      });
    }

    cb(err, entities);
  });
};

Session.prototype.get = function(query, id, cb) {
  var config = query.modelConfig;

  var options = {
    type: config.collection,
    name: id
  };

  this.client.getEntity(options, function(err, result) {
    var obj;

    if (!err) {
      obj = convertToModel(config, result);
    }

    cb(err, obj);
  });
};

Session.create = function(options, configFunc) {
  var session = new Session(options);
  var config = new SessionConfig(session);

  configFunc(config);

  session.init(config);

  return session;
};
