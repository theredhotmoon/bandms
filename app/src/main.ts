import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import 'vue-sonner/style.css'

const app = createApp(App)

app.use(router)
app.use(VueQueryPlugin)
app.use(createPinia())

app.mount('#app')
