import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/tags/:tag',
      name: 'tag',
      component: () => import('@/pages/TagPage.vue'),
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/pages/ProjectsPage.vue'),
    },
    {
      path: '/bookmarks/:collection?',
      name: 'bookmarks',
      component: () => import('@/pages/BookmarksPage.vue'),
    },
    {
      path: '/springboard/:collection?',
      name: 'springboard',
      component: () => import('@/pages/TabSpringboardPage.vue'),
    },
    {
      path: '/:collection/:slug(.*)',
      name: 'doc',
      component: () => import('@/pages/DocPage.vue'),
    },
  ],
})

export default router
