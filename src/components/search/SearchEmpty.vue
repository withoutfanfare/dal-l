<script setup lang="ts">
defineProps<{
  query: string
}>()
</script>

<template>
  <div class="px-6 py-10 text-center text-sm text-text-secondary">
    <template v-if="!query.trim()">
      Type to search across all documents
    </template>
    <template v-else>
      No documents found for &lsquo;{{ query }}&rsquo;
    </template>
  </div>
</template>
