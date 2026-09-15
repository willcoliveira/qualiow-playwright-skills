#!/usr/bin/env node
import { resolve, join } from 'node:path'
import { loadRuleManifest, checkRuleDrift } from '../src/rules.js'

const root = resolve(process.argv[2] ?? process.cwd())
const skillsDir = join(import.meta.dirname, '..', 'skills')

const issues = checkRuleDrift(root, loadRuleManifest(skillsDir))
if (issues.length === 0) {
  console.log(`No rule drift in ${root}`)
  process.exit(0)
}
for (const issue of issues) console.error(`${issue.file}: ${issue.message}`)
console.error(`\n${issues.length} rule(s) have drifted between the reference that owns them and the summaries that restate them.`)
process.exit(1)
