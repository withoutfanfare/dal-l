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
      path: '/:collection/:slug(.*)',
      name: 'doc',
      component: () => import('@/pages/DocPage.vue'),
    },
  ],
})

export default router
