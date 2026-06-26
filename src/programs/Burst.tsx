export function burstEmojiNotif(s: string) {
  const burst = document.createElement("div")
  burst.className = "burst"

  const star = document.createElement("span")
  star.textContent = s
  // start paused so the element gets laid out & painted before frame 0 runs
  star.style.animationPlayState = "paused"
  burst.appendChild(star)

  document.body.appendChild(burst)
  star.addEventListener("animationend", () => burst.remove())

  // let the browser commit the initial frame, then unpause on a clean tick
  requestAnimationFrame(() => requestAnimationFrame(() => {
    star.style.animationPlayState = "running"
  }))
}
