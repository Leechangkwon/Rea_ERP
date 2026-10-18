const {sqliteTable,text,integer}=require('drizzle-orm/sqlite-core');
exports.gatewayState=sqliteTable('gateway_state',{
  id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),
  body:text('body').notNull(),updatedAt:text('updated_at').notNull()
});
exports.appState=sqliteTable('app_state',{
  id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),
  body:text('body').notNull(),updatedAt:text('updated_at').notNull()
});
