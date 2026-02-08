import { defineConfig } from './scripts/lib/config'

export default defineConfig({
  collections: [
    {
      id: 'engineering-handbook',
      name: 'Engineering Handbook',
      icon: '📘',
      source: process.env.DALIL_HANDBOOK_PATH || '/Users/dannyharding/Herd/scooda-worktrees/documentation-tidy-up/project/engineering-handbook/',
      description: 'Development standards, architecture, and best practices',
    },
  ],
})
