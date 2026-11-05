import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  addCredential,
  generatePassword,
  getCredential,
  initVault,
  listCredentials,
} from './vaultService.js'

test('credential services persist and return safe credential data', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-cli-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))

  const context = {
    vaultPath: join(directory, 'vault.json'),
    masterPassword: 'a test master password',
  }
  await initVault(context)

  const added = await addCredential(context, {
    name: 'Example',
    username: 'user',
    password: 'credential-secret',
    url: 'https://example.com',
    notes: 'private note',
  })

  assert.equal(added.name, 'Example')
  assert.equal(added.password, 'credential-secret')

  const fetched = await getCredential(context, 'example')
  assert.equal(fetched.id, added.id)
  assert.equal(fetched.notes, 'private note')

  const listed = await listCredentials(context)
  assert.equal(listed.length, 1)
  assert.deepEqual(Object.keys(listed[0]).sort(), [
    'createdAt',
    'id',
    'name',
    'updatedAt',
    'url',
    'username',
  ])
})

test('password generation respects length and includes required character groups', () => {
  const password = generatePassword({ length: 20 })

  assert.equal(password.length, 20)
  assert.match(password, /[A-Z]/)
  assert.match(password, /[a-z]/)
  assert.match(password, /[0-9]/)
  assert.ok(
    '!@#$%^&*()-_=+[]{}:,.?'.split('').some((symbol) =>
      password.includes(symbol),
    ),
  )
})
