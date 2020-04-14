# egg o2sql plugin

## Install

```bash
$ npm i egg-o2sql --save
```

Then install o2sql-pg if you use postgres

```bash
$ npm i o2sql-pg --save
```

## Configuration

### Enable egg-o2sql

`{app_root}/config/plugin.js`:

```js
exports.o2sql = {
  enable: true,
  package: 'egg-o2sql',
};
```

### pg connection settings

`${app_root}/config/config.default.js`:

```js
exports.o2sql = {
  client: {
    type: 'pg',
    user: 'pguser',
    host: 'localhost',
    database: 'pgdb',
    password: 'pgpassword',
    port: 5432,
    debug: false,
  },
};
```

```js
exports.o2sql = {
  client: {
    type: 'pg',
    user: 'pguser',
    host: 'localhost',
    database: 'pgdb',
    password: 'pgpassword',
    port: 5432,
    debug: false,
  },
  clients: {
    another: {
      type: 'pg',
      another: {
      user: 'pguser',
      host: 'localhost',
      database: 'pgdb',
      password: 'pgpassword',
      port: 5432,
      debug: false,
    },
  }
};
```

Value of "client" is for the default client (app.o2ql.select() ...).

Value of "clients" is for other clients (app.o2sqlClient('another).select() ...)

Under each client settings:

**type**: 'pg' or 'postgres' for now.mysql support (type: 'mysql') will be available in the future.

**debug**: true/false, show sql and values in console if debug is true.

others are for node-postgres.

Refer to https://node-postgres.com for details.

## Usage

### default client

```javascript
const products = await app.o2sql
  .select(['id', 'name', 'price'])
  .from('product')
  .where({
    id: {
      IN: o2sql.select(['id']).from('productCat').where({ catId: 1 }),
    },
  })
  .pagination(2, 10)
  .orderby(['id'])
  .execute();
```

```javascript
const result = await app.pg.transition(async client => {
  const products = await app.o2sql
    .select(['id', 'name', 'price'])
    .from('product')
    .where({
      id: {
        IN: o2sql.select(['id']).from('productCat').where({ catId: 1 }),
      },
    })
    .pagination(2, 10)
    .orderby(['id'])
    .execute(client);
  await app.o2sql
    ....
    .execute(client);
  return products;
});
```

### other clients

```javascript
const o2sql = app.o2sqlClient('another');
const products = await o2sql
  .select(['id', 'name', 'price'])
  .from('product')
  .where({
    id: {
      IN: o2sql.select(['id']).from('productCat').where({ catId: 1 }),
    },
  })
  .pagination(2, 10)
  .orderby(['id'])
  .execute();
```

Refer to https://github.com/qdechochen/o2sql for o2sql details.
