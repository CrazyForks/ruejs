import { ref } from '@rue-js/rue'

/**
 * 路由 demo 的共享开关：
 * - false：访问实验页时会被 beforeEnter 重定向回守卫说明页
 * - true：允许进入实验页
 */
export const routerDemoLabEnabled = ref(false)
