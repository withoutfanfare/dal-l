import { ref } from 'vue'
import { verifyFtsConsistency, rebuildFtsIndex } from '@/lib/api'
import type { FtsConsistencyResult } from '@/lib/types'

const result = ref<FtsConsistencyResult | null>(null)
const verified = ref(false)
const rebuilding = ref(false)

export function useFtsHealth() {
  async function verify() {
    try {
      result.value = await verifyFtsConsistency()
      verified.value = true
    } catch (e) {
      console.error('FTS consistency check failed:', e)
      result.value = null
      verified.value = false
    }
  }

  async function rebuild(): Promise<string> {
    rebuilding.value = true
    try {
      const message = await rebuildFtsIndex()
      // Re-verify after rebuild
      await verify()
      return message
    } finally {
      rebuilding.value = false
    }
  }

  return { result, verified, rebuilding, verify, rebuild }
}
