'use strict';
const { Pool, Client } = require('pg');
const o2sql = require('o2sql');

function capFirstLetter(s) {
  return s[0].toUpperCase() + s.substring(1);
}
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
    let result = await (client ? client : pool).query({ text, values });
    let columns;
    if (this.command === 'select') {
      if (this.isCount) {
        columns = null;
        result = result.rows[0].count;
      } else {
        columns = this._columns;
        result = result.rows;
      }
    } else if (this.command === 'insert' || this.command === 'update') {
      result = result.rows;
      columns = this._returning;
    } /* else if (this.command === 'delete') {
      result = result;
    }*/
    if (columns) {
      const groups = columns.filter(t => t.group);
      if (groups.length > 0) {
        groups.forEach(g => {
          const group = {};
          g.fields = g.fields.map(f => {
            if (f instanceof Array) {
              const [column, alias] = column;
              f = alias || column;
            }
            return [
              g.prefix
                ? g.prefix + (g.separator ? g.separator + f : capFirstLetter(f))
                : f,
              f,
            ];
          });
        });

        result.forEach(r => {
          groups.forEach(g => {
            r[g.prefix] = {};
            g.fields.forEach(f => {
              r[g.prefix][f[1]] = r[f[0]];
              delete r[f[0]];
            });
          });
        });
      }
    }

    if (this.command === 'insert' || this.command === 'update') {
      result = result[0];
    } else if (this.command === 'select' && this.isGet) {
      result = result.length > 0 ? result[0] : null;
    }

    return result;
  });
  app.o2sql = o2sql;

  async function queryWithObject(text, data, client) {
    console.log('[egg-pg] queryWithObject');
    console.dir(arguments);
    return await (client ? client : pool).queryWithObject(text, data);
  }

  async function query(text, vals, client) {
    console.log('[egg-pg] query');
    console.dir({ text, vals });
    return await (client ? client : pool).query(text, vals);
  }

  async function transaction(queries, client) {
    if (!client) {
      client = await pool.connect();

      let result, error;
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
    } else {
      return await queries(client);
    }
  }

  app.beforeStart(async () => {
    const { rows } = await query('select now() as "currentTime"');
    console.log(
      `[egg-pg] instance status OK, rds currentTime: ${rows[0].currentTime}`
    );
  });

  return {
    queryWithObject,
    query,
    transaction,
    pool,
  };
}
