'use strict';

const clients = {};

module.exports = (app) => {
  const config = app.config.o2sql;
  const pgConfigs = {};
  const mysqlConfigs = {};
  if (!('clients' in config)) {
    config.clients = {};
  }
  if ('client' in config) {
    config.clients.default = config.client;
  }
  for (const name of Object.keys(config.clients)) {
    if (['postgres', 'pg'].includes(config.clients[name].type)) {
      pgConfigs[name] = config.clients[name];
    }
    if (['mysql'].includes(config.clients[name].type)) {
      mysqlConfigs[name] = config.clients[name];
    }
  }
  if (Object.keys(pgConfigs).length > 0) {
    const O2sqlPg = require('o2sql-pg');

    for (const key of Object.keys(pgConfigs)) {
      clients[key] = new O2sqlPg(pgConfigs[key]);
    }
  }
  if (Object.keys(mysqlConfigs).length > 0) {
    const O2sqlMysql = require('o2sql-mysql');

    for (const key of Object.keys(mysqlConfigs)) {
      clients[key] = new O2sqlMysql(mysqlConfigs[key]);
    }
  }
  if ('default' in clients) {
    app.o2sql = clients.default;
  } else {
    console.log("[o2sql] no default client set")
  }
  app.o2sqlClient = (name) => {
    if (name in clients) {
      return clients[name];
    }

    throw new Error('O2sql client ' + name + ' not found');
  };
};
