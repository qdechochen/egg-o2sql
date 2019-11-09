'use strict';
const { Pool, Client } = require('pg');
const o2sql = require('o2sql');

function capFirstLetter(s) {
  return s[0].toUpperCase() + s.substring(1);
}

module.exports = app => {
  app.addSingleton('pg', createPgClient);
};

function createPgClient(config, app) {
  const pool = new Pool(config);

  o2sql.setOnExecuteHandler(async function({ sql: text, values }, client) {
    console.log('[egg-o2sql] o2sql query');
    console.dir({
      text,
      values,
    });
    let result = await (client ? client : pool).query({ text, values });
    let columns;
    if (this instanceof o2sql.command.Select) {
      if (this instanceof o2sql.command.Count) {
        columns = null;
        result = result.rows[0].count;
      } else {
        columns = this.data.columns;
        result = result.rows;
      }
    } else if (
      this instanceof o2sql.command.Insert ||
      this instanceof o2sql.command.Update
    ) {
      result = result.rows;
      columns = this.data.returning;
    }
    if (columns) {
      const groups = columns.filter(t => t.group);
      if (groups.length > 0) {
        groups.forEach(g => {
          const group = {};
          g.fields = (g.fields || g.columns).map(f => {
            if (f instanceof Array) {
              const [column, alias] = f;
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

    if (
      this instanceof o2sql.command.Insert ||
      this instanceof o2sql.command.Update
    ) {
      result = result[0];
    } else if (this instanceof o2sql.command.Get) {
      result = result.length > 0 ? result[0] : null;
    }

    return result;
  });
  app.o2sql = o2sql;

  async function query(text, vals, client) {
    console.log('[egg-o2sql] query');
    console.dir({ text, vals });
    return await (client ? client : pool).query(text, vals);
  }

  async function transaction(queries, client) {
    const transitionClient = client || (await pool.connect());
    let result, error;
    try {
      await transitionClient.query('BEGIN');
      console.log('TRANSACTION BEGINS.............');

      result = await queries(transitionClient);

      await transitionClient.query('COMMIT');
      console.log('TRANSACTION COMMITTED.............');
    } catch (e) {
      console.dir(e);
      error = e;
      await transitionClient.query('ROLLBACK');
      console.log('TRANSACTION ROLLBACK.............');
    } finally {
      if (!client) {
        transitionClient.release();
      }
    }
    if (error) {
      throw error;
    } else {
      return result;
    }
  }

  app.beforeStart(async () => {
    const { rows } = await query('select now() as "currentTime"');
    console.log(
      `[egg-o2sql] instance status OK, rds currentTime: ${rows[0].currentTime}`
    );
  });

  return {
    query,
    transaction,
    pool,
  };
}
