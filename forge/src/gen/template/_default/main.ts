import { createApp } from "vue";
import '@/global.css'
import './style.css'
import App from './App.vue'


async function main(){
  const app = createApp(App);
  app.mount("#app");
}
main();