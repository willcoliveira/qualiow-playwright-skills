import { cli } from '../src/cli.js'

cli(process.argv.slice(2))
  .then(code => {
    process.exitCode = code
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  })
