const router = require('express').Router()

let connectDB = require('./../database.js')

let db
connectDB.then((client)=>{
    db = client.db('forum') //--DB명
}).catch((err)=>{
  console.log(err)
})

router.get('/shirt', async (request, response)=>{
    response.send('셔츠파는 페이지임')
})

router.get('/pants',(request, response)=>{
    response.send('바지파는 페이지임')
})

module.exports = router