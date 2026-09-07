import { resolve } from 'node:path'
import { validateOutputTree } from '../src/validate.js'

const root = resolve(process.argv[2] ?? process.cwd())
const issues = validateOutputTree(root)

if (issues.length > 0) {
  for (const issue of issues) console.error(`${issue.file}: ${issue.message}`)
  console.error(`\n${issues.length} issue(s) found under ${root}`)
  process.exit(1)
}
console.log(`OK: generated output under ${root} passed validation`)
