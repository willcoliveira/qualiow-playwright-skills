import { cli } from '../src/cli.js'

const args = process.argv.slice(2)
const command = args[0] ?? 'init'

cli(command, args.slice(1))
