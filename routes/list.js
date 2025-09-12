let router = require('express').Router()
let connectDB = require('../database.js')
const {MongoClient, ObjectId} = require('mongodb')

let db
connectDB.then((client)=>{
    db = client.db('forum')
}).catch((err)=>{
    console.log(err)
})

//--값을 줄 때는 request에 담아서 보내야 받아지나? 그리고 받는 쪽도 request로 받아야하나?
function userChk(request, response, next){
    if(!request.user) request.user = ""
    else request.user._id
    next() //--안쓰면 무한 대기 
}

router.get('/list', async (request,response)=>{
    try{
        //--await 다음 줄 실행하기 전에 기다려라/ 혹은 .then()
        let result = await db.collection('post').find().limit(5).toArray()

        if(result == null){
            response.status(500).send('조회 도중 에러발생')
        }
        //--ejs를 사용해서 데이터를 꽂음
        response.render('list.ejs',{글목록: result, user: request.user? request.user._id.toString() : "", pageCnt: 5}) //--request.user._id는 ObjectId 타입임
    }catch(e){
        console.log(e)
        response.status(500).send('DB에러 발생')
    }
})

router.get('/list/:page', async (request, response)=>{
    //--1~5번글을 찾아서 저장
    //--.skip()은 성능이 안좋음 너무 많이 스킵하는건 안쓰는게 좋음
    let result = await db.collection('post').find().skip((request.params.page - 1)*5).limit(5).toArray()
    response.render('list.ejs',{글목록: result, user: request.user? request.user._id.toString() : "", pageCnt: 5})
})

router.get('/list/next/:id',async (request, response)=>{
    //--1~5번글을 찾아서 저장
    //--.find({})에 조건을 넣어서 찾음 굉장히 빠름 단 123숫자가 아니라 다음으로 바꿔야함
    //--정수로 하는게 더 좋음
    let result = await db.collection('post').find({_id: {$gt: new ObjectId(request.params.id)}}).limit(5).toArray()
    response.render('list.ejs',{글목록: result, user: request.user? request.user._id.toString() : "", pageCnt: 5})
})

module.exports = router