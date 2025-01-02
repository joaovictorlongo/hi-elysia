import { Database } from "bun:sqlite";
const db = new Database("mydb.sqlite", { create: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS user (
    username TEXT PRIMARY KEY,
    password TEXT
  )
`);
console.log('TABLE user created');

db.exec(`
  CREATE TABLE IF NOT EXISTS session (
    token TEXT PRIMARY KEY,
    username TEXT
  )
`);
console.log('TABLE session created');

db.exec(`
  CREATE TABLE IF NOT EXISTS note (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    author TEXT
  )
`);
console.log('TABLE note created');