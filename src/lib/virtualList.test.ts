import test from 'node:test'
import assert from 'node:assert/strict'
import { computeVirtualRange } from './virtualList'

test('computeVirtualRange returns zeroed range for empty list', () => {
  const range = computeVirtualRange({
    totalItems: 0,
    scrollTop: 50,
    rowHeight: 100,
    viewportHeight: 600,
    overscan: 10,
  })
  assert.deepEqual(range, {
    start: 0,
    end: 0,
    topSpacerHeight: 0,
    bottomSpacerHeight: 0,
  })
})

test('computeVirtualRange clamps and calculates window', () => {
  const range = computeVirtualRange({
    totalItems: 200,
    scrollTop: 1500,
    rowHeight: 100,
    viewportHeight: 600,
    overscan: 2,
  })
  assert.equal(range.start, 13)
  assert.equal(range.end, 23)
  assert.equal(range.topSpacerHeight, 1300)
  assert.equal(range.bottomSpacerHeight, 17700)
})
