import express from 'express'
import { JSONFilePreset } from 'lowdb/node'

const db = await JSONFilePreset('server/db.json', { store: {} })

const app = express()
app.use(express.urlencoded({ extended: false }))

app.post('/store', async (req, res) => {
  // const { key, value } = req.body
  console.log(req)
  // db.data.store[key] = value
  // await db.write()
  // res.json({ key, value })
})

app.get('/get', (req, res) => {
  const { key } = req.query
  res.json(db.data.store[key])
})

app.listen(3001, () => console.log('listening on http://localhost:3001'))
