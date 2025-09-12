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
//--소켓통신
const { createServer } = require('http')
const { join } = require("path");
const { Server } = require('socket.io')
const server = createServer(app)
const httpServer = createServer(app);
const io = new Server(httpServer) 

const sessionMiddleware = session({
  secret: "changeit",
  resave: true,
  saveUninitialized: true,
});
app.use(sessionMiddleware);

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
const { Socket } = require('dgram')

let db
 let changeStream
connectDB.then((client)=>{
    console.log('DB연결성공')
    db = client.db('forum') //--DB명

    //-- 딱 한번만 실행되는게 더 효율적임
    let 조건 = {$match: {operationType : 'insert'}} //--.을 찍을거면 ''로 감싸야한다
    //--collection을 실시간 변화 감지
    changeStream = db.collection('post').watch(조건)

    //--DB에 연결된 후 서버에 접속되는 편이 낫다
    httpServer.listen(process.env.PORT, () =>{
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

app.post("/incr", (req, res) => {
  const session = req.session;
  session.count = (session.count || 0) + 1;
  res.status(200).end("" + session.count);
});

//--유저가/: 뒤에 아무 문자나 입력한다면
app.get('/detail/:id', async (request,response)=>{
    try{
        //--request.params == i(detail/뒤에 붙은 값)
        let result = await db.collection('post').findOne({_id : new ObjectId(request.params.id) }) 
        let comment = await db.collection('comment').find({post_id : new ObjectId(request.params.id)}).toArray()
        
        if(result == null){
            response.status(404).send('이상한 url 입력함')
        }
        response.render('detail.ejs',{detail: result, comment: comment})
    }catch(e){
        console.log(e)
        response.status(404).send('이상한 url 입력함')
    }
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
app.use('/',require('./routes/etc.js'))
app.use('/',require('./routes/list.js')) //--글목록

let search_val = ""

app.get('/search', async (request, response)=>{
    search_val = request.query.val
    let 검색조건 = [
        {$search:{
            index: 'title_index', //--인덱스 명
            text: {query: search_val, path: 'title' } //--값 필드명
        }}, 
        {$limit: 3},
        //{$project: {title:1}},//--0은 숨겨 1은 보여줘

    ]
    //--정규식({$regex:})을 쓰면 느림 => 인덱스를 거의 못 씀
    //--index를 만들면 빠르게 찾아줌 {$text : {$search: request.query.val} }
    let result = await db.collection('post').aggregate(검색조건).toArray()
    response.render('search.ejs',{글목록: result})
})

app.get('/search/next/:id', async (request, response)=>{
    let 검색조건 = [
        {$search:{
            index: 'title_index', //--인덱스 명
            text: {query: search_val, path: 'title' } //--값 필드명
        }}, 
        {$skip: (request.params.id-1)*3}
        //{$project: {title:1}},//--0은 숨겨 1은 보여줘

    ]
    //--정규식({$regex:})을 쓰면 느림 => 인덱스를 거의 못 씀
    //--index를 만들면 빠르게 찾아줌 {$text : {$search: request.query.val} }
    let result = await db.collection('post').aggregate(검색조건).toArray()
    response.render('search.ejs',{글목록: result, page : request.params.id+1})
})

app.post('/comment', async (request, response)=>{
    let param = {
        post_id: new ObjectId(request.body.post_id), 
        content: request.body.content, 
        username: request.user.username, 
        id: request.user._id,
    }
    try{
        /** @type{ { title: string, content: string } } */
        let result = await db.collection('comment').insertOne(param)
        if(result){
            param.resmsg = "OK"
            response.send(param)
        } 
        else response.send('FAIL')
    }catch(e){
        console.log(e)
        response.send('댓글 등록 중 에러 발생')
    }
    //response.redirect(request.get('Referrer')) //--이전페이지로 이동
})

app.get('/chat/request', async (request, response)=>{

    let result = await db.collection('chatroom').find({member: new ObjectId(request.query.orther_id)}).toArray()
    if(result.length < 1 ){
        await db.collection('chatroom').insertOne({
            member: [request.user._id, new ObjectId(request.query.orther_id)], //--array로 저장함
            //other_id : new ObjectId(request.query.orther_id),
            orther_username : request.query.orther_username,
            //my_id : request.user._id,
            my_username: request.user.username,
            date: new Date()
        })
    }
    response.redirect('/chat/list')
})

app.get('/chat/list', async (request,response)=>{
    let result = await db.collection('chatroom').find({member: request.user._id}).toArray()
    response.render('chat.ejs',{chatList: result})
})

app.get('/chat/detail/:id', async (request, response)=>{
    if(!request.user) response.send('<script>alert("로그인 해주세요.");location.href="/login"</script>')
    else{
        if(!await db.collection('chatroom').findOne({member: request.user._id, _id: new ObjectId(request.params.id)}))
            response.send('<script>alert("권한이 없습니다.");location.href="/list"</script>')
        else{
            let result = await db.collection('chatroom').findOne({_id: new ObjectId(request.params.id)})
            let result2 = await db.collection('chat').find({room: new ObjectId(request.params.id)}).toArray()
            response.render('chatDetail.ejs',{data:[{chatRoomInfo: result},{chatContent: result2}]})
        }
    }
})

// io.on('connection',(socket)=>{
    
//     //--유저가 보낸 데이터
//     socket.on('age',(data)=>{
//         console.log('유저가 보낸 데이터: ', data)
//         io.emit('name','kim')
//     })

//     socket.on('ask-join',(data)=>{
//         //--룸에 있는 사용자에게만 메세지를 보낼 수 있게 함
//         socket.join(data)
//     })

//     socket.on('message',(data)=>{
//         io.to(data.room).emit('broadcast',data.msg)
//     })
// })

io.engine.use(sessionMiddleware);
io.on('connection',(socket)=>{
    console.log(socket.request.session)
    if(!socket.request.session) socket.response.send("<script>alert('로그인 해주세요.);location.href='/login'</script>")
    else {
        var send_user = socket.request.session.passport.user.id;
        socket.on('chat',async (data)=>{
            let param = {
                room: new ObjectId(data.room),
                content: data.content,
                send_user: new ObjectId(send_user),
                data: new Date()
            }
            socket.join(data.room)
            await db.collection('chat').insertOne(param)

            io.to(data.room).emit('data',param)
        })
    }
})

//-- server sent event (서버에서 유저에게 실시간으로 데이터를 보내줌)
app.get('/stream/list',(request, response)=>{
    response.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
    })

    changeStream.on('change',(result)=>{
        console.log(result.fullDocument)
        response.write('event: msg\n')
        response.write(`data: ${JSON.stringify(result.fullDocument)}\n\n`)
    })
    // setInterval(()=>{
    //     //--이 형식 그대로 사용 
    //     response.write('event: msg\n')
    //     response.write('data: "바보"\n\n')
    // },1000)
})


