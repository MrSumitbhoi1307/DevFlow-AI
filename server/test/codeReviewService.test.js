const { test } = require('node:test')
const assert = require('node:assert/strict')
const { MAX_CODE_BYTES, RULES, reviewCode } = require('../services/codeReview')

function findingsFor(code, rule) {
  return reviewCode(code).findings.filter((finding) => finding.rule === rule)
}

test('eval and new Function are reported, while ordinary calls are not', () => {
  assert.equal(findingsFor('eval(source)\nnew Function(source)', RULES.eval).length, 2)
  assert.equal(findingsFor('const result = parse(source)', RULES.eval).length, 0)
})

test('secret-looking literal assignments are reported without echoing their value', () => {
  const secret = 'never-echo-this-secret'
  const findings = findingsFor(`const password = "${secret}"`, RULES.secrets)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].line, 1)
  assert.equal(JSON.stringify(findings).includes(secret), false)
  assert.equal(findingsFor('const password = readPassword()', RULES.secrets).length, 0)
})

test('console.log is reported but other console methods are not', () => {
  assert.equal(findingsFor('console.log("debug")', RULES.console).length, 1)
  assert.equal(findingsFor('console.error("failure")', RULES.console).length, 0)
})

test('var is reported while let and const are accepted', () => {
  assert.equal(findingsFor('var item = 1', RULES.var).length, 1)
  assert.equal(findingsFor('let item = 1\nconst other = 2', RULES.var).length, 0)
})

test('loose equality is reported but strict equality is accepted', () => {
  assert.equal(findingsFor('a == b\na != b', RULES.equality).length, 2)
  assert.equal(findingsFor('a === b\na !== b', RULES.equality).length, 0)
})

test('empty catch blocks are reported but handled catches are accepted', () => {
  assert.equal(findingsFor('try { work() } catch (error) {}', RULES.catch).length, 1)
  assert.equal(findingsFor('try { work() } catch (error) { report(error) }', RULES.catch).length, 0)
})

test('TODO and FIXME comments are reported but ordinary comments are not', () => {
  assert.equal(findingsFor('// TODO finish this\n/* FIXME later */', RULES.todo).length, 2)
  assert.equal(findingsFor('// implementation note\nconst text = "TODO"', RULES.todo).length, 0)
})

test('only lines longer than 120 characters are reported', () => {
  assert.equal(findingsFor('x'.repeat(121), RULES.longLine).length, 1)
  assert.equal(findingsFor('x'.repeat(120), RULES.longLine).length, 0)
})

test('functions longer than 60 lines are reported', () => {
  const longFunction = `function longWork() {\n${Array(60).fill('  run()').join('\n')}\n}`
  const shortFunction = `function shortWork() {\n${Array(58).fill('  run()').join('\n')}\n}`
  assert.equal(findingsFor(longFunction, RULES.longFunction).length, 1)
  assert.equal(findingsFor(shortFunction, RULES.longFunction).length, 0)
})

test('blocks nested more than five levels are reported', () => {
  const deep = 'function work() { if (a) { if (b) { if (c) { if (d) { if (e) { run() } } } } } }'
  const shallow = 'function work() { if (a) { if (b) { if (c) { if (d) { run() } } } } }'
  assert.equal(findingsFor(deep, RULES.nesting).length, 1)
  assert.equal(findingsFor(shallow, RULES.nesting).length, 0)
})

test('review output is deterministic and summarizes severities with a bounded score', () => {
  const code = 'eval(input)\nconsole.log(input)'
  const first = reviewCode(code)
  assert.deepEqual(reviewCode(code), first)
  assert.equal(first.reviewer, 'rule-based')
  assert.deepEqual(first.summary, {
    findings: 2,
    bySeverity: { info: 0, warning: 1, error: 1 },
    score: 72,
  })
  assert.equal(reviewCode('').summary.score, 100)
})

test('review service rejects source exceeding the byte limit', () => {
  assert.throws(() => reviewCode('a'.repeat(MAX_CODE_BYTES + 1)), /50 KB/)
})
