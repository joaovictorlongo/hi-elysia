import { Elysia, error, t } from "elysia";
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite", { create: true });

export const userService = new Elysia({ name: 'user/service' })
  .model({
    signIn: t.Object({
      username: t.String({ minLength: 1 }),
      password: t.String({ minLength: 8 })
    }),
    session: t.Cookie(
      {
        token: t.Number()
      },
      {
        secrets: 'Booya'
      }
    ),
    optionalSession: t.Optional(t.Ref('session'))
  })
  .macro({
    isSignIn(enabled: boolean) {
      if (!enabled) return
      return {
        beforeHandle({ error, cookie: { token } }) {
          if (!token.value) {
            return error(401, {
              success: false,
              message: 'Unauthorized'
            })
          }
          const user = db.query('SELECT username FROM session WHERE token = $token').get({ $token: token.value });
          if (!user) {
            return error(401, {
              success: false,
              message: 'Unauthorized'
            })
          }
        }
      }
    }
  })

export const getUserId = new Elysia()
  .use(userService)
  .guard({
    isSignIn: true,
    cookie: 'session'
  })
  .resolve(
    ({ cookie: { token } }) => ({
      user: db.query<{ username: string }, { $token: number }>('SELECT username FROM session WHERE token = $token').get({ $token: token.value })
    })
  )
  .as('plugin')

export const user = new Elysia({ prefix: '/user' })
  .use(userService)
  .put('/sign-up', async ({ body: { username, password }, error }) => {
    const user = db.query('SELECT * FROM user WHERE username = $username').get({ $username: username });
    if (user) {
      return error(400, {
        success: false,
        message: 'Username already exists'
      })
    }
    db.query('INSERT INTO user (username, password) VALUES ($username, $password)').run({
      $username: username,
      $password: await Bun.password.hash(password)
    });
    return {
      success: true,
      message: 'User created successfully'
    }
  }, {
    body: 'signIn'
  })
  .post('/sign-in', async ({
    error,
    body: { username, password },
    cookie: { token }
  }) => {
    const user = db.query<{ username: string, password: string }, { $username: string }>('SELECT username, password FROM user WHERE username = $username').get({ $username: username });
    if (!user || !(await Bun.password.verify(password, user.password))) {
      return error(400, {
        success: false,
        message: 'Invalid username or password'
      })
    }
    const session = db.query<{ token: number }, { $username: string }>('SELECT token FROM session WHERE username = $username').get({ $username: username });
    if (session) {
      token.value = session.token;
      return {
        success: true,
        message: `User ${username} signed in successfully`,
        token: session.token
      }
    }
    const key = crypto.getRandomValues(new Uint32Array(1))[0];
    db.query('INSERT INTO session (token, username) VALUES ($token, $username)').run({
      $token: key,
      $username: username
    }).lastInsertRowid;
    token.value = key;
    return {
      success: true,
      message: `User ${username} signed in successfully`,
      token: key
    }
  }, {
    body: 'signIn',
    cookie: 'session'
  })
  .use(getUserId)
  .get('/sign-out', async ({ cookie: { token } }) => {
    db.query('DELETE FROM session WHERE token = $token').run({ $token: token.value });
    token.remove();
    return {
      success: true,
      message: 'User signed out successfully'
    }
  }, {
    cookie: 'optionalSession'
  })
  .get('/profile', ({user}) => {
    return {
      success: true,
      user: user?.username
    }
  }, {
    isSignIn: true,
    cookie: 'session'
  })

