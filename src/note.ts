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

  list() {
    const notes = db.query('SELECT * FROM note').all();
    return notes;
  }

  get(id: number) {
    const note = db.query('SELECT * FROM note WHERE id = $id').get({ $id: id });
    return note;
  }

  add(note: Memo & { username: string }) {
    const insertedNote = db.query('INSERT INTO note (data, author) VALUES ($data, $author)').run({ $data: note.data, $author: note.username });
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
  .get('/', ({ note }) => {
    return note.list();
  })
  .use(getUserId)
  .put('/', ({ note, body: { data }, user }) => {
    return note.add({ data, username: user?.username ?? 'unknown' });
  }, {
    body: memo
  })
  .guard({
    params: t.Object({
      id: t.Number()
    })
  })
  .get('/:id', ({ note, params: { id } }) => {
    return  note.get(id) ?? error(404, 'not found');
  })
  .delete('/:id', ({ note, params: { id }, error }) => {
    const hasNote = note.get(id);
    if (hasNote) {
      return note.remove(id);
    }
    return error(422, 'invalid id');
  })
  .patch('/:id', ({ note, params: { id }, body: { data }, error }) => {
    const hasNote = note.get(id);
    if (hasNote) {
      return note.update(id, { data });
    }
    return error(422, 'invalid id');
  }, {
    body: memo
  })