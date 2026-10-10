const dns = require('node:dns/promises')
const http = require('node:http')
const https = require('node:https')
const net = require('node:net')
const { performance } = require('node:perf_hooks')

const REQUEST_TIMEOUT_MS = 8_000
const MAX_RESPONSE_BYTES = 1_048_576
const MAX_BODY_BYTES = 102_400
const MAX_HEADER_BYTES = 16_384
const BLOCKED_REQUEST_HEADERS = new Set([
  'authorization', 'cookie', 'host', 'connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length',
  'set-cookie',
])
const RESPONSE_HEADER_ALLOWLIST = new Set([
  'cache-control', 'content-type', 'etag', 'last-modified', 'location', 'retry-after',
])

function parseIpv4(address) {
  if (net.isIP(address) !== 4) return null
  return address.split('.').map(Number)
}

function parseIpv6(address) {
  if (net.isIP(address) !== 6) return null
  let input = address.toLowerCase().split('%')[0]

  const dottedTail = input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (dottedTail) {
    const octets = parseIpv4(dottedTail[1])
    if (!octets) return null
    const high = ((octets[0] << 8) | octets[1]).toString(16)
    const low = ((octets[2] << 8) | octets[3]).toString(16)
    input = input.slice(0, -dottedTail[1].length) + `${high}:${low}`
  }

  const halves = input.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - left.length - right.length
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null
  const groups = [...left, ...Array(missing).fill('0'), ...right]
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) return null
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n)
}

function inV4Range(octets, prefix, bits) {
  const value = octets.reduce((result, octet) => (result << 8n) | BigInt(octet), 0n)
  return (value >> BigInt(32 - bits)) === (prefix >> BigInt(32 - bits))
}

function isBlockedIpv4(address) {
  const octets = parseIpv4(address)
  if (!octets) return true
  const value = octets.reduce((result, octet) => (result << 8n) | BigInt(octet), 0n)
  const ranges = [
    [0x00000000n, 8],   // unspecified and current network
    [0x0a000000n, 8],   // private
    [0x64400000n, 10],  // carrier-grade NAT
    [0x7f000000n, 8],   // loopback
    [0xa9fe0000n, 16],  // link-local, including cloud metadata
    [0xac100000n, 12],  // private
    [0xc0a80000n, 16],  // private
    [0xe0000000n, 4],   // multicast and reserved
    [0xf0000000n, 4],   // reserved
  ]
  return ranges.some(([prefix, bits]) => (value >> BigInt(32 - bits)) === (prefix >> BigInt(32 - bits)))
    || value === 0xffffffffn
}

function isBlockedAddress(address) {
  const family = net.isIP(address)
  if (family === 4) return isBlockedIpv4(address)
  if (family !== 6) return true

  const value = parseIpv6(address)
  if (value === null) return true
  if (value === 0n || value === 1n) return true // unspecified, loopback
  if ((value >> 121n) === 0x7en) return true // unique-local fc00::/7
  if ((value >> 118n) === 0x3fan) return true // link-local fe80::/10
  if ((value >> 120n) === 0xffn) return true // multicast

  if ((value >> 32n) === 0xffffn) {
    const mappedIpv4 = Number(value & 0xffffffffn)
    const octets = [(mappedIpv4 >>> 24) & 255, (mappedIpv4 >>> 16) & 255, (mappedIpv4 >>> 8) & 255, mappedIpv4 & 255]
    return isBlockedIpv4(octets.join('.'))
  }
  return false
}

function parseAndCheckUrl(input) {
  let url
  try {
    url = new URL(input)
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are allowed')
  const authority = input.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1] || ''
  if (authority.includes('@') || url.username || url.password) throw new Error('URLs with embedded credentials are not allowed')
  if (!url.hostname) throw new Error('A hostname is required')
  return url
}

async function validateTarget(input) {
  const url = parseAndCheckUrl(input)
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  let addresses
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('The destination hostname could not be resolved')
  }
  if (!addresses.length) throw new Error('The destination hostname has no addresses')
  if (addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error('Requests to local or non-public network addresses are not allowed')
  }
  return { url, addresses }
}

function filteredRequestHeaders(headers = {}) {
  const filtered = {}
  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase()
    if (BLOCKED_REQUEST_HEADERS.has(lowerName) || lowerName.startsWith('proxy-') || lowerName.startsWith('x-forwarded-')) continue
    filtered[name] = value
  }
  if (!Object.keys(filtered).some((name) => name.toLowerCase() === 'accept-encoding')) {
    filtered['accept-encoding'] = 'identity'
  }
  return filtered
}

function filteredResponseHeaders(headers = {}) {
  const result = {}
  for (const [name, value] of Object.entries(headers)) {
    if (RESPONSE_HEADER_ALLOWLIST.has(name.toLowerCase())) result[name.toLowerCase()] = value
  }
  return result
}

function sendHttpRequest({ target, method, headers, body, timeoutMs = REQUEST_TIMEOUT_MS, maxResponseBytes = MAX_RESPONSE_BYTES }) {
  const { url, addresses } = target
  const address = addresses[0]
  if (!address) return Promise.reject(new Error('The validated destination has no address'))

  const startedAt = performance.now()
  const transport = url.protocol === 'https:' ? https : http
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const requestOptions = {
    protocol: url.protocol,
    hostname,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method,
    headers: filteredRequestHeaders(headers),
    servername: url.protocol === 'https:' && net.isIP(hostname) === 0 ? hostname : undefined,
    lookup(_requestedHostname, options, callback) {
      if (options?.all) callback(null, [{ address: address.address, family: address.family }])
      else callback(null, address.address, address.family)
    },
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let response
    let timer
    const finish = (error, result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(result)
    }

    const request = transport.request(requestOptions, (incoming) => {
      response = incoming
      const chunks = []
      let bytes = 0
      let truncated = false
      const resultBase = {
        status: incoming.statusCode || 0,
        statusText: incoming.statusMessage || '',
        headers: filteredResponseHeaders(incoming.headers),
      }
      const complete = () => finish(null, {
        ...resultBase,
        durationMs: Math.round(performance.now() - startedAt),
        body: Buffer.concat(chunks).toString('utf8'),
        truncated,
      })

      incoming.on('data', (chunk) => {
        if (settled) return
        const available = maxResponseBytes - bytes
        if (chunk.length > available) {
          if (available > 0) chunks.push(chunk.subarray(0, available))
          bytes = maxResponseBytes
          truncated = true
          incoming.destroy()
          complete()
          return
        }
        chunks.push(chunk)
        bytes += chunk.length
      })
      incoming.on('end', complete)
      incoming.on('error', (error) => {
        if (!truncated) finish(error)
      })
    })

    request.on('error', (error) => finish(error))
    timer = setTimeout(() => {
      const error = new Error(`The request timed out after ${timeoutMs} ms`)
      error.code = 'ETIMEDOUT'
      request.destroy(error)
      response?.destroy()
    }, timeoutMs)
    if (body) request.write(body)
    request.end()
  })
}

module.exports = {
  MAX_BODY_BYTES,
  MAX_HEADER_BYTES,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  filteredRequestHeaders,
  isBlockedAddress,
  parseAndCheckUrl,
  sendHttpRequest,
  validateTarget,
}
