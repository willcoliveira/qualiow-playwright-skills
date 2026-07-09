import { cli } from '../src/cli.js'

const args = process.argv.slice(2)
const command = args[0] ?? 'init'

cli(command, args.slice(1)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
