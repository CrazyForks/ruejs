import { useApp } from '@rue-js/rue'
import { createApp } from './main'
import './style.css'

const { app, router } = createApp()

router.isReady().then(() => {
  useApp(app).use(router).mount('#app')
})
