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
    const { rowCount, rows } = await (client ? client : pool).query({
      text,
      values,
    });
    rows.count = rowCount;

    let result;
    if (this instanceof o2sql.command.Count) {
      result = rows[0].count;
    } else {
      if (rows.length > 0) {
        let columns;
        if (this instanceof o2sql.command.Select) {
          columns = this.data.columns;
        } else if (
          this instanceof o2sql.command.Insert ||
          this instanceof o2sql.command.Update ||
          this instanceof o2sql.command.Delete
        ) {
          columns = this.data.returning;
        }

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
                  ? g.prefix +
                    (g.separator ? g.separator + f : capFirstLetter(f))
                  : f,
                f,
              ];
            });
          });

          rows.forEach(r => {
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

      if (this instanceof o2sql.command.Insert) {
        if (rowCount === 0) {
          return null;
        } else if (this.data.values.length === 1) {
          result = rows.length > 0 ? rows[0] : {};
        } else {
          result = rows;
        }
      } else if (
        this instanceof o2sql.command.Update ||
        this instanceof o2sql.command.Delete
      ) {
        if (rowCount === 0) {
          return null;
        } else {
          result = rows;
        }
      } else if (this instanceof o2sql.command.Get) {
        result = rows.length > 0 ? rows[0] : null;
      } else if (this instanceof o2sql.command.Select) {
        result = rows;
      }
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
