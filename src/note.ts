import { Elysia, error, t } from "elysia";
import { getUserId, userService } from "./user";
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite", { create: true });

const memo = t.Object({
  data: t.String()
});

type Memo = typeof memo.static;

class Note {
  constructor() { }

  add(note: Memo) {
    const insertedNote = db.query('INSERT INTO note (data, author) VALUES ($data, $author)').run(note);
    return insertedNote;
  }

  remove(id: number) {
    db.query('DELETE FROM note WHERE id = $id').run({ $id: id });
    return true;
  }

  update(id: number, note: Partial<Memo>) {
    db.query('UPDATE note SET data = $data, author = $author WHERE id = $id').run({ $id: id, ...note });
    return true;
  }
}

export const note = new Elysia({ prefix: '/note' })
  .use(userService)
  .decorate('note', new Note())
  .onTransform(function log({ body, params, path, request: { method } }) {
    console.log(`${method} ${path}`, {
      body,
      params
    });
  })
  .get('/', () => {
    const notes = db.query('SELECT * FROM note').all();
    return notes;
  })
  .use(getUserId)
  .put('/', ({ body: { data }, user }) => {
    const note = db.query('INSERT INTO note (data, author) VALUES ($data, $author)').run({ $data: data, $author: user?.username ?? 'Unknown' });
    return note;
  }, {
    body: memo
  })
  .guard({
    params: t.Object({
      id: t.Number()
    })
  })
  .get('/:id', ({ params: { id } }) => {
    return db.query('SELECT * FROM note WHERE id = $id').get({ $id: id }) ?? error(404, 'not found');
  })
  .delete('/:id', ({ params: { id }, error }) => {
    const note = db.query('SELECT * FROM note WHERE id = $id').get({ $id: id });
    console.log('note', note)
    if (note) {
      db.query('DELETE FROM note WHERE id = $id').run({ $id: id });
      return true;
    }
    return error(422, 'invalid id');
  })
  .patch('/:id', ({ params: { id }, body: { data }, error, user }) => {
    const note = db.query('SELECT * FROM note WHERE id = $id').get({ $id: id });
    if (note) {
      db.query('UPDATE note SET data = $data, author = $author WHERE id = $id').run({ $id: id, $data: data, $author: user?.username ?? 'Unknown' });
      return true;
    }
    return error(422, 'invalid id');
  }, {
    body: memo
  })