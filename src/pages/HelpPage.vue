<script setup lang="ts">
import type { Document } from '@/lib/types'
import ContentHeader from '@/components/content/ContentHeader.vue'
import DocumentView from '@/components/content/DocumentView.vue'
import { useToast } from '@/composables/useToast'

const { addToast } = useToast()

const helpHtml = `
  <h2 id="getting-started">Getting started</h2>
  <ol>
    <li>Open <strong>Projects</strong> and switch to the handbook you need.</li>
    <li>Use the sidebar to browse sections and pages.</li>
    <li>Use search (<strong>Cmd/Ctrl + K</strong>) to jump quickly.</li>
    <li>Bookmark key pages and keep active work in tabs.</li>
  </ol>

  <h2 id="navigation">Navigation</h2>
  <ul>
    <li>Use the left sidebar for structure and section browsing.</li>
    <li>Use top tabs to keep multiple pages open in parallel.</li>
    <li>Use the right panel on document pages for table of contents, notes, and highlights.</li>
  </ul>

  <h2 id="shortcuts">Common shortcuts</h2>
  <ul>
    <li><strong>Cmd/Ctrl + K</strong>: open search</li>
    <li><strong>Cmd/Ctrl + \\</strong>: toggle sidebar</li>
    <li><strong>Cmd/Ctrl + [</strong> / <strong>Cmd/Ctrl + ]</strong>: back / forward</li>
    <li><strong>/</strong>: focus search</li>
  </ul>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <ul>
    <li>If results look stale, rebuild the project from the Projects page.</li>
    <li>If navigation looks wrong after project switch, switch away and back once.</li>
    <li>If search is unexpectedly empty, check that your handbook build completed successfully.</li>
  </ul>
`

const helpDocument: Document = {
  id: -1,
  collection_id: 'help',
  slug: 'help',
  title: 'Dalil Help',
  section: 'User Guide',
  sort_order: 0,
  parent_slug: '',
  content_html: helpHtml,
  path: '/help',
  last_modified: '2026-02-18',
}

async function handleShareLink() {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/help`)
    addToast('Help link copied', 'success')
  } catch {
    addToast('Could not copy help link', 'error')
  }
}

function openShortcutHelp() {
  window.dispatchEvent(new CustomEvent('dalil:open-shortcuts-help'))
}
</script>

<template>
  <div class="min-w-0 max-w-4xl">
    <ContentHeader
      :document="helpDocument"
      @share-link="handleShareLink"
    />
    <DocumentView :document="helpDocument" />
    <div class="mt-4">
      <button
        class="inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface-secondary/30 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
        @click="openShortcutHelp"
      >
        Open full shortcut list
      </button>
    </div>
  </div>
</template>
