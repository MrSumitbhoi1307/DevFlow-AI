const MAX_CODE_BYTES = 50 * 1024

const RULES = {
  eval: 'avoid-eval',
  secrets: 'hardcoded-secret',
  console: 'console-log',
  var: 'prefer-const-or-let',
  equality: 'strict-equality',
  catch: 'empty-catch',
  todo: 'todo-comment',
  longLine: 'long-line',
  longFunction: 'long-function',
  nesting: 'deep-nesting',
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length
}

function countBraces(line) {
  let open = 0
  let close = 0
  for (const character of line) {
    if (character === '{') open += 1
    if (character === '}') close += 1
  }
  return { open, close }
}

function findFunctionStarts(lines) {
  const candidates = []
  const declaration = /\bfunction\b[^{}]*\{/g
  const arrow = /(?:\([^{}]*\)|[$\w]+)\s*=>\s*\{/g
  const method = /^\s*(?:async\s+)?[$\w]+\s*\([^{}]*\)\s*\{/g

  lines.forEach((line, lineIndex) => {
    if (/^\s*(?:if|for|while|switch|catch|with)\s*\(/.test(line)) return
    for (const pattern of [declaration, arrow, method]) {
      pattern.lastIndex = 0
      if (pattern.test(line)) {
        candidates.push(lineIndex)
        break
      }
    }
  })
  return candidates
}

function functionLength(lines, startIndex) {
  let depth = 0
  let started = false
  for (let index = startIndex; index < lines.length; index += 1) {
    const counts = countBraces(lines[index])
    depth += counts.open - counts.close
    if (counts.open > 0) started = true
    if (started && depth <= 0) return index - startIndex + 1
  }
  return started ? lines.length - startIndex + 1 : 0
}

function collectFindings(code) {
  const findings = []
  const add = (rule, severity, line, message, suggestion) => {
    findings.push({ rule, severity, line, message, suggestion })
  }
  const lines = code.split(/\r?\n/)

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(line)) {
      add(RULES.eval, 'error', lineNumber, 'Dynamic code evaluation is present.', 'Avoid eval and new Function; use explicit, trusted control flow.')
    }
    if (/\b(?:password|secret|token|api[_-]?key)\s*=\s*(['"`])/.test(line)) {
      add(RULES.secrets, 'error', lineNumber, 'A secret-like value is assigned from a literal.', 'Read secrets from a secure configuration source and never commit them.')
    }
    if (/\bconsole\s*\.\s*log\s*\(/.test(line)) {
      add(RULES.console, 'warning', lineNumber, 'A console.log call is left in the code.', 'Remove the debug log or use the project’s approved logging approach.')
    }
    if (/\bvar\s+[$\w]+/.test(line)) {
      add(RULES.var, 'warning', lineNumber, 'The var keyword is used.', 'Prefer const by default, or let when reassignment is needed.')
    }
    const looseEquality = /(?<![=!])(?:==|!=)(?!=)/g
    if (looseEquality.test(line)) {
      add(RULES.equality, 'warning', lineNumber, 'Loose equality can coerce values unexpectedly.', 'Use === or !== after checking the intended types.')
    }
    if (line.length > 120) {
      add(RULES.longLine, 'info', lineNumber, 'This line is longer than 120 characters.', 'Break the expression into smaller, readable lines.')
    }
    if (/\/\/.*\b(?:TODO|FIXME)\b|\/\*.*\b(?:TODO|FIXME)\b.*\*\//i.test(line)) {
      add(RULES.todo, 'info', lineNumber, 'A TODO or FIXME comment remains in the code.', 'Resolve the note or track it in the project issue system.')
    }
  })

  const catchPattern = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g
  for (const match of code.matchAll(catchPattern)) {
    add(RULES.catch, 'warning', lineNumberAt(code, match.index), 'An empty catch block silently discards errors.', 'Handle, report, or deliberately rethrow the error.')
  }

  for (const startIndex of findFunctionStarts(lines)) {
    if (functionLength(lines, startIndex) > 60) {
      add(RULES.longFunction, 'warning', startIndex + 1, 'This function spans more than 60 lines.', 'Split the function into smaller units with clear responsibilities.')
    }
  }

  let braceDepth = 0
  let inDeepRegion = false
  lines.forEach((line, index) => {
    for (const character of line) {
      if (character === '{') {
        braceDepth += 1
        if (braceDepth > 5 && !inDeepRegion) {
          add(RULES.nesting, 'warning', index + 1, 'This block is nested more than five levels deep.', 'Extract nested logic into named helper functions or return early.')
          inDeepRegion = true
        }
      } else if (character === '}') {
        braceDepth = Math.max(0, braceDepth - 1)
        if (braceDepth <= 5) inDeepRegion = false
      }
    }
  })

  return findings.sort((left, right) => left.line - right.line || left.rule.localeCompare(right.rule))
}

function summarize(findings) {
  const bySeverity = { info: 0, warning: 0, error: 0 }
  for (const finding of findings) bySeverity[finding.severity] += 1
  const score = Math.max(0, 100 - bySeverity.error * 20 - bySeverity.warning * 8 - bySeverity.info * 2)
  return { findings: findings.length, bySeverity, score }
}

function reviewCode(code) {
  if (typeof code !== 'string') throw new TypeError('Code must be a string')
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) throw new RangeError('Code must not exceed 50 KB')
  const findings = collectFindings(code)
  return { reviewer: 'rule-based', summary: summarize(findings), findings }
}

module.exports = { MAX_CODE_BYTES, RULES, reviewCode, summarize }
