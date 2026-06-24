// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.jsx'
import { isDev } from './debug.js'

let clearStateClickCount = 0

setTimeout(() => {
  if (isDev && document.getElementById('root').children.length == 0) {
    document.addEventListener('click', () => {
      clearStateClickCount += 1

      document.querySelector('body').appendChild(document.createTextNode(`${5 - clearStateClickCount} clicks untill reset! -- `))

      if (clearStateClickCount < 5) return

      localStorage.clear()
      console.log('cleared local storage')
      document.querySelector('body').appendChild(document.createTextNode('cleared local storage'))
    })
  }
}, 5000)

createRoot(document.getElementById('root')).render(
  // <StrictMode> </StrictMode>,
  <App />
)
