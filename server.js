const express = require('express')
const app = express()

//--css같은 파일을 자유롭게 사용하기 위해 서버에 등록
app.use(express.static(__dirname+'/public'))
app.set('view engine','ejs') //--ejs setting
//--request.body를 사용할 수 있게 하기 위한 선언
app.use(express.json())
app.use(express.urlencoded({extended:true}))
//--put/delete를 사용하고 싶을때
const methodOverride = require('method-override')
app.use(methodOverride('_method'))

//--세션 라이브러리
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',
  resave : false, //--유저가 요청할 때마다 갱신할건지
  saveUninitialized : false //--로그인을 안해도 세션을 만들것인지
}))

app.use(passport.session()) 

const { MongoClient, ObjectId } = require('mongodb')

let db
const url = 'mongodb+srv://imhyelyeong_db_user:OIp1vu5xZ4UUyWRS@froum.cj978t5.mongodb.net/?retryWrites=true&w=majority&appName=Froum'
new MongoClient(url).connect().then((client)=>{
    console.log('DB연결성공')
    db = client.db('forum') //--DB명
    //--DB에 연결된 후 서버에 접속되는 편이 낫다
    app.listen(3000, () =>{
     console.log('http://localhost:3000/ 에서 서버 실행중')
    })
}).catch((err)=>{
  console.log(err)
})

app.get('/',(request, response)=>{
    //--__dirname: 현재 프로젝트 절대경로
    response.sendFile(__dirname+'/index.html') //--파일을 보냄
})

//--url/news로 들어가면 오늘 비옴이라는 문자가 나온다
app.get('/news',(request, response)=>{
    //--DB collection(하위 폴더명) 적고 작성
    db.collection('post').insertOne({title: '어쩌구'})
    //response.send('오늘 비옴')
})

app.get('/about', (request,response)=>{
    response.sendFile(__dirname+'/myself.html')
})

app.get('/list', async (request,response)=>{
    try{
        //--await 다음 줄 실행하기 전에 기다려라/ 혹은 .then()
        let result = await db.collection('post').find().toArray()
        //--응답은 한번만 실행
        //response.send(result[0].title) //--templet engein

        if(result == null){
            response.status(500).send('조회 도중 에러발생')
        }
        //--ejs를 사용해서 데이터를 꽂음
        response.render('list.ejs',{글목록: result})
    }catch(e){
        console.log(e)
        response.status(500).send('DB에러 발생')
    }
})

app.get('/time',(requset, response)=>{
    var time = new Date().toTimeString().split(" ")[0]
    response.render('time.ejs',{time: time})
})

app.get('/write',(request,response)=>{
    response.render('write.ejs')//--앞에/를 붙이니까 안나왔음
})

app.post('/add', async (request,response)=>{
    console.log(request.body)

    try{
        if(request.body.title == '' ){
            response.send('제목입력요구')
        }else{
            //--웬만하면 맞추는게 좋음
            await db.collection('post').insertOne({title:request.body.title ,content:request.body.title})
            response.redirect('/list')//-- 특정 url로 이동
        }
    }catch(e){
        console.log(e)
        response.status(500).send('서버 에러 남')
    }
})

//--유저가/: 뒤에 아무 문자나 입력한다면
app.get('/detail/:id', async (request,response)=>{
    try{
        //--request.params == i(detail/뒤에 붙은 값)
        let result = await db.collection('post').findOne({_id : new ObjectId(request.params.id) }) 
        console.log(result)
        if(result == null){
            response.status(404).send('이상한 url 입력함')
        }
        response.render('detail.ejs',{detail: result})
    }catch(e){
        console.log(e)
        response.status(404).send('이상한 url 입력함')
    }
})

app.get('/edit/:id', async (request,response)=>{
    try{
        let detail = await db.collection('post').findOne({_id: new ObjectId(request.params.id)})
        if(detail == null) response.status(500).send('수정할 데이터 없음')
        response.render('edit.ejs',{detail:detail})
    }catch(e){
        console.log(e)
        response.status(400).send('잘못된 url 접근')
    }
})

app.post('/edit', async (request, response)=>{
    //console.log(request.body)
    
    //--개별 수정은 updateOne/ 여러개 수정은 updateMany /filtering도 가능
    //await db.collection('post').updateMany({like : {$ne: 10}}, {$inc: {like: 2}}) 

    try{
        if(request.body.title == '' || request.body.content == '') response.send('제목/내용 작성하세요')
        else{
            await db.collection('post').updateOne({_id: new ObjectId(request.body._id)}, 
                                                    {$set: {title: request.body.title, content: request.body.content}})

            response.redirect('/list')
        }
    }catch(e){
        console.log(e)
        response.status(500).send('수정 실패')
    }
    
})

app.get('/abc',(requset,response)=>{
    console.log('안녕')
    console.log(requset.query)//--requset.query는 ?뒤에 붙는 데이터를 가져옴
})

app.delete('/delete', async (requset,response)=>{
    console.log(requset.query)

    await db.collection('post').deleteOne({_id: new ObjectId(requset.query._id)})
    //--ajax 사용할 때 redirect, render는 사용 안하는게 낫다
    response.send('삭제완료')
})

app.get('/list/:page',async (request, response)=>{
    //--1~5번글을 찾아서 저장
    //--.skip()은 성능이 안좋음 너무 많이 스킵하는건 안쓰는게 좋음
    let result = await db.collection('post').find().skip((request.params.page - 1)*5).limit(5).toArray()
    response.render('list.ejs',{글목록: result})
})

app.get('/list/next/:id',async (request, response)=>{
    //--1~5번글을 찾아서 저장
    //--.find({})에 조건을 넣어서 찾음 굉장히 빠름 단 123숫자가 아니라 다음으로 바꿔야함
    //--정수로 하는게 더 좋음
    let result = await db.collection('post').find({_id: {$gt: new ObjectId(request.params.id)}}).limit(5).toArray()
    response.render('list.ejs',{글목록: result})
})

//--검사하는 로직
passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
    try{
        let result = await db.collection('user').findOne({ username : 입력한아이디})
        if (!result) {
            return cb(null, false, { message: '아이디 DB에 없음' })
        }
        if (result.password == 입력한비번) {
            return cb(null, result)
        } else {
            return cb(null, false, { message: '비번불일치' });
        }
    }catch(e){
        console.log(e)
        return cb(null, false, { message: 'DB 조회 실패' })
    }
    //--passReqToCallback: 아이디 비번 제외 다른 것도 검증하고 싶을 때
}))

app.get('/login',async (request, response)=>{
    response.render('login.ejs')
})

app.post('/login',async (request, response, next)=>{
    passport.authenticate('local', (error, user, info)=>{
        //--user는 실패시 false
        if(error) return response.status(500).json(error)
        if(!user) return response.status(401).json(info.message)
        request.logIn(user, (err)=>{
            if(err) return next(err)
            response.redirect('/')
        })
    })(request,response,next) //--비교작업 코드 실행
})

app.get('/join',(request, response)=>{
    response.render('join.ejs')
})

app.post('/join', async (request, response)=>{
    //console.log(request.body)
    try{
        if(request.body.username == '' || request.body.password == '') response.status(400).send('아이디/비번을 입력하세요.')
        await db.collection('user').insertOne({username: request.body.username, password: request.body.password})
        response.redirect('/login')
    }catch(e){
        console.log(e)
        response.status(500).send('회원가입 실패')
    } 
})