//--글 작성/ 수정/ 삭제 하는 기능
let router = require('express').Router()
let connectDB = require('./../database.js')
const { MongoClient, ObjectId } = require('mongodb')

const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.S3_KEY,
      secretAccessKey : process.env.S3_SECRETY
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BURKET,
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})

let db
connectDB.then((client)=>{
    db = client.db('forum') //--DB명
}).catch((err)=>{
  console.log(err)
})

router.get('/write',(request,response)=>{
    if(typeof request.user == 'undefined') response.send("<script>alert('로그인 먼저 해주세요');location.href='/login'</script>")
    else response.render('write.ejs')//--앞에/를 붙이니까 안나왔음
})

//--여러개를 쓸때는 array, ('',2) 숫자를 넣으면 갯수 제한
router.post('/add' , (request,response)=>{
    upload.single('img1')(request,response,async (err)=>{
        if(err) return response.send("<script>alert('업로드 에러.');location.href='/list'</script>")
        try{
            if(request.body.title == '' ){
                response.send('제목입력요구')
            }else{
                let val
                //--웬만하면 맞추는게 좋음
                await db.collection('post').insertOne(
                    {
                        title:request.body.title,
                        content:request.body.title,
                        img: request.file? request.file.location : '', 
                        user: request.user._id, 
                        username: request.user.username
                    }
                )
                response.redirect('/list')//-- 특정 url로 이동
            }
        }catch(e){
            console.log(e)
            response.status(500).send('서버 에러 남')
        }
    })
})

router.get('/edit/:id', async (request,response)=>{
    try{
        let detail = await db.collection('post').findOne({_id: new ObjectId(request.params.id)})
        if(detail == null) response.status(500).send('수정할 데이터 없음')
        response.render('edit.ejs',{detail:detail})
    }catch(e){
        console.log(e)
        response.status(400).send('잘못된 url 접근')
    }
})

router.post('/edit', async (request, response)=>{
    //console.log(request.body)
    
    //--개별 수정은 updateOne/ 여러개 수정은 updateMany /filtering도 가능
    //await db.collection('post').updateMany({like : {$ne: 10}}, {$inc: {like: 2}}) 

    try{
        if(request.body.title == '' || request.body.content == '') response.send('제목/내용 작성하세요')
        else{
            let result = await db.collection('post').updateOne({_id: new ObjectId(request.body._id), user: new ObjectId(request.user._id)}, 
                                                    {$set: {title: request.body.title, content: request.body.content}})
            
            //console.log(result)
            response.redirect('/list')
        }
    }catch(e){
        console.log(e)
        response.status(500).send('수정 실패')
    }
    
})

router.delete('/delete', async (request,response)=>{
    console.log(request.user)

    let result = await db.collection('post').deleteOne({
        _id: new ObjectId(request.query._id),
        user: new ObjectId(request.user._id) //--내가 작성한 글만 삭제하게
    })
    
    //--ajax 사용할 때 redirect, render는 사용 안하는게 낫다
    if(result.deletedCount == 1) response.send('OK')
    else response.send('FAIL')
})

module.exports = router