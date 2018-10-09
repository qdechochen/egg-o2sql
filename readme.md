# egg o2sql plugin with pg integreted

## Install
```bash
$ npm i egg-o2sql --save
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

### pg settings
`${app_root}/config/config.default.js`:
```js
exports.pg = {
  default: {
    user: 'pguser',
    host: 'localhost',
    database: 'pgdb',
    password: 'pgpassword',
    port: 5432,
  },
};
```
Refer to https://node-postgres.com for details.

## Usage
```js
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
Refer to https://github.com/qdechochen/o2sql for o2sql details.