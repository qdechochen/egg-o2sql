'use strict';
const { Pool, Client } = require('pg');
const o2sql = require('o2sql');

const queryWithObjectReplacer = (() => {
  return (template, data) => {
    const values = [];
    return {
      text: template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = data && data.hasOwnProperty(key) ? data[key] : null;
        values.push(value);
        return `$${values.length}`;
      }),
      values,
    };
  };
})();

Client.prototype.queryWithObject = function(text, values, callback) {
  const config = queryWithObjectReplacer(text, values);
  return this.query(config.text, config.values, callback);
};

module.exports = app => {
  app.addSingleton('pg', createPgClient);
};

function createPgClient(config, app) {
  const pool = new Pool(config);

  o2sql.setOnExecuteHandler(async function({ sql: text, values }, client) {
    console.dir({
      text,
      values,
    });
    const result = await (client ? client : pool).query({ text, values });
    if (this.command === 'select') {
      if (this.isGet) {
        return result.rows.length > 0 ? result.rows[0] : null;
      } else if (this.isCount) {
        return result.rows[0].count;
      }
      return result.rows;
    } else if (this.command === 'insert') {
      return result.rows[0];
    } else if (this.command === 'update') {
      return result.rows[0];
    } else if (this.command === 'delete') {
      return result;
    }
  });
  app.o2sql = o2sql;

  async function queryWithObject(text, data, client) {
    console.log('[egg-pg] queryWithObject');
    console.dir(arguments);
    return await (client ? client : pool).queryWithObject(text, data);
  }

  async function query(text, vals, client) {
    console.log('[egg-pg] query');
    console.dir(arguments);
    return await (client ? client : pool).query(text, vals);
  }

  async function transaction(queries) {
    const client = await pool.connect();

    let result,
      error;
    try {
      await client.query('BEGIN');
      console.log('TRANSACTION BEGINS.............');

      result = await queries(client);

      await client.query('COMMIT');
      console.log('TRANSACTION COMMITTED.............');
    } catch (e) {
      console.dir(e);
      error = e;
      await client.query('ROLLBACK');
      console.log('TRANSACTION ROLLBACK.............');
    } finally {
      client.release();
    }
    if (error) {
      throw error;
    } else {
      return result;
    }
  }

  app.beforeStart(async () => {
    const { rows } = await query('select now() as "currentTime"');
    console.log(`[egg-pg] instance status OK, rds currentTime: ${rows[0].currentTime}`);
  });

  return {
    queryWithObject,
    query,
    transaction,
    pool,
  };
}
