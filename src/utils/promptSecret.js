import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { stdin, stdout } from 'node:process'
import { VaultError, ErrorCode } from './errors.js'

export async function promptSecret(message, { confirm = false } = {}) {
  const input = await readHiddenInput(message)

  if (!confirm) {
    return input
  }

  const confirmation = await readHiddenInput(`Confirm ${message}`)

  if (input !== confirmation) {
    throw new VaultError(
      ErrorCode.INVALID_INPUT,
      'Master passwords do not match',
    )
  }

  return input
}

function readHiddenInput(message) {
  return new Promise((resolve, reject) => {
    const silentOutput = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })

    const rl = createInterface({
      input: stdin,
      output: silentOutput,
      terminal: true,
    })

    let answered = false

    rl.on('close', () => {
      if (!answered) {
        reject(
          new VaultError(
            ErrorCode.OPERATION_CANCELLED,
            'Input cancelled',
          ),
        )
      }
    })

    rl.on('error', (error) => {
      rl.close()
      reject(error)
    })

    stdout.write(`${message}: `)

    rl.question('', (answer) => {
      answered = true
      rl.close()
      stdout.write('\n')
      resolve(answer)
    })
  })
}
