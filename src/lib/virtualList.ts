export interface VirtualRangeInput {
  totalItems: number
  scrollTop: number
  rowHeight: number
  viewportHeight: number
  overscan: number
}

export interface VirtualRangeResult {
  start: number
  end: number
  topSpacerHeight: number
  bottomSpacerHeight: number
}

export function computeVirtualRange(input: VirtualRangeInput): VirtualRangeResult {
  const totalItems = Math.max(0, input.totalItems)
  const rowHeight = Math.max(1, input.rowHeight)
  const viewportHeight = Math.max(1, input.viewportHeight)
  const overscan = Math.max(0, input.overscan)
  const scrollTop = Math.max(0, input.scrollTop)

  if (totalItems === 0) {
    return {
      start: 0,
      end: 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    }
  }

  const rawStart = Math.floor(scrollTop / rowHeight) - overscan
  const start = Math.max(0, rawStart)
  const visibleRows = Math.ceil(viewportHeight / rowHeight) + (overscan * 2)
  const end = Math.min(totalItems, start + visibleRows)

  return {
    start,
    end,
    topSpacerHeight: start * rowHeight,
    bottomSpacerHeight: Math.max(0, (totalItems - end) * rowHeight),
  }
}
