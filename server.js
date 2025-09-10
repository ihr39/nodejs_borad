const express = require('express')
const app = express()
const { MongoClient, ObjectId } = require('mongodb')
//--세션 라이브러리
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
//--암호화
const bcrypt = require('bcrypt')
//-- session을 DB에 저장
const MongoStore = require('connect-mongo')
//--put/delete를 사용하고 싶을때
const methodOverride = require('method-override')
require('dotenv').config()

//--css같은 파일을 자유롭게 사용하기 위해 서버에 등록
app.use(express.static(__dirname+'/public'))
app.set('view engine','ejs') //--ejs setting
//--request.body를 사용할 수 있게 하기 위한 선언
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(methodOverride('_method'))
app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',
  resave : false, //--유저가 요청할 때마다 갱신할건지
  saveUninitialized : false, //--로그인을 안해도 세션을 만들것인지
  cookie: {maxAge: 60 * 60 * 1000}, //--1시간동안 유지하게 설정/ 기본은 2주
  store: MongoStore.create({//--세션을 db에 저장해주는 기능
    mongoUrl: process.env.DB_URL,
    dbName: 'forum',
  })
}))
app.use(passport.session()) 

let connectDB = require('./database.js')

let db
connectDB.then((client)=>{
    console.log('DB연결성공')
    db = client.db('forum') //--DB명
    //--DB에 연결된 후 서버에 접속되는 편이 낫다
    app.listen(process.env.PORT, () =>{
     console.log('http://localhost:3000/ 에서 서버 실행중')
    })
}).catch((err)=>{
  console.log(err)
})

//--미들웨어(변수 3개 필요) []로 미들웨어 함수 여러개 넣을 수 있다
function loginChk(request, response, next){
    if(!request.user){
        response.send("<script>alert('로그인하세요');location.href='/login'</script>")
    }
    else next()//--미들웨어 실행 끝나고 다음으로 이동
}

//--하위 url도 모두 적용
//app.use('/write',loginChk)//--이 코드 밑에 있는 API는 미들웨어를 적용
function dateChk(request,response,next){
    console.log(new Date) 
    next()
}
app.use('/list',dateChk)

function emptyChk(request, response, next){
    if(request.body.username == '' || request.body.password == ''){
        response.send("<script>alert('아이디/비번을 작성해주세요.');location.href='/login'</script>")
    }else next()
}

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
        response.render('list.ejs',{글목록: result, user: request.user._id.toString() }) //--request.user._id는 ObjectId 타입임
    }catch(e){
        console.log(e)
        response.status(500).send('DB에러 발생')
    }
})

app.get('/time',(requset, response)=>{
    var time = new Date().toTimeString().split(" ")[0]
    response.render('time.ejs',{time: time})
})

//--유저가/: 뒤에 아무 문자나 입력한다면
app.get('/detail/:id', async (request,response)=>{
    try{
        //--request.params == i(detail/뒤에 붙은 값)
        let result = await db.collection('post').findOne({_id : new ObjectId(request.params.id) }) 
        if(result == null){
            response.status(404).send('이상한 url 입력함')
        }
        response.render('detail.ejs',{detail: result})
    }catch(e){
        console.log(e)
        response.status(404).send('이상한 url 입력함')
    }
})

app.get('/abc',(requset,response)=>{
    console.log('안녕')
    console.log(requset.query)//--requset.query는 ?뒤에 붙는 데이터를 가져옴
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
        if (await bcrypt.compare(입력한비번, result.password)) {
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

//--로그인 세션 만들기
passport.serializeUser((user, done) => {
    process.nextTick(() => {//--특정 코드를 비동기적으로 처리해줌
        //--DB에 연결을 해야 DB에 발행됨 아니면 메모리에 저장됨
        done(null, {username : user.username, id: user._id})
    })
})

//--유저가 보낸 쿠키 분석 특정 API안에서만 사용하게 만들면 좀 더 효율적일듯
passport.deserializeUser(async (user, done) => {
    //--session document에 있는 정보만 가져오기 때문에 오래된 경우 달라질 가능성 있음=>세션에 적힌 유저정보 가져옴-회원정보 DB에 가져옴 그걸 넣음
    let result = await db.collection('user').findOne({_id: new ObjectId(user.id)})
    delete result.password //--password는 삭제하고 보냄
    process.nextTick(() => {//--특정 코드를 비동기적으로 처리해줌
        //--DB에 연결을 해야 DB에 발행됨 아니면 메모리에 저장됨
        done(null, result)
    })
})
//--이런 코드들 밑에서는 아무렇게나 request.user로 조회 가능

app.get('/login',async (request, response)=>{
    response.render('login.ejs')
})

app.post('/login', emptyChk ,async (request, response, next)=>{
    passport.authenticate('local', (error, user, info)=>{
        //--user는 실패시 false
        if(error) return response.status(500).json(error)
        if(!user) return response.status(401).json(info.message)
        request.logIn(user, (err)=>{
            if(err) return next(err)
            response.redirect('/list')
        })
    })(request,response,next) //--비교작업 코드 실행
})

app.get('/join',(request, response)=>{
    response.render('join.ejs')
})

app.post('/join', emptyChk , async (request, response)=>{
    let result = await db.collection('user').findOne({username: request.body.username})
    if(result != null) 
        response.status(400).send('<script>alert("이미 있는 아이디입니다");location.href="/join"</script>')
    else if(request.body.password != request.body.password_chk) 
        response.status(400).send("<script>alert('비밀번호가 틀립니다.');location.href='/join'</script>")
    else{
        let hash = await bcrypt.hash(request.body.password,10)
        
        try{
            await db.collection('user').insertOne({username: request.body.username, password: hash})
            response.redirect('/login')
        }catch(e){
            console.log(e)
            response.status(500).send('회원가입 실패')
        } 
    }
})

app.get('/myPage',(requset, response)=>{
    if(typeof requset.user == 'undefined') response.send("<script>alert('로그인 먼저 해주세요');location.href='/login'</script>")
    else response.render('myPage.ejs',{username: requset.user.username})
})

app.get('/logout', async (requeset, response)=>{
    try{
        await requeset.session.destroy(function(e){
            if(e){
                console.log(e)
                response.send("<script>alert('로그아웃 실패.')</script>")
            }else{
                response.redirect('/list')
            }
        })
    }catch{
        console.log(e)
        response.status(500).send('로그아웃 도중 문제 발생')
    }
})

app.use('/shop',require('./routes/shop.js')) //--미들웨어식으로 적용

app.use('/board/sub',require('./routes/sub.js'))

app.use('/post',require('./routes/post.js'))

app.get('/search', async (request, response)=>{
    let 검색조건 = [
        {$search:{
            index: 'title_index', //--인덱스 명
            text: {query: request.query.val, path: 'title' } //--값 필드명
        }}, 
        //{$limit: 3},
        //{$project: {title:1}},//--0은 숨겨 1은 보여줘

    ]
    //--정규식({$regex:})을 쓰면 느림 => 인덱스를 거의 못 씀
    //--index를 만들면 빠르게 찾아줌 {$text : {$search: request.query.val} }
    let result = await db.collection('post').aggregate(검색조건).toArray()
    response.render('search.ejs',{글목록: result})
})

