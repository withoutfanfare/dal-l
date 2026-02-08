import { defineConfig } from './scripts/lib/config'

export default defineConfig({
  collections: [
    {
      id: 'engineering-handbook',
      name: 'Engineering Handbook',
      icon: '📘',
      source: '/Users/dannyharding/Herd/scooda-worktrees/documentation-tidy-up/project/engineering-handbook/',
      description: 'Development standards, architecture, and best practices',
    },
  ],
})
