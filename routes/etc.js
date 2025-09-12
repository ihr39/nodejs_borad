let router = require('express').Router()

//--url/news로 들어가면 오늘 비옴이라는 문자가 나온다
router.get('/news',(request, response)=>{
    //--DB collection(하위 폴더명) 적고 작성
    //db.collection('post').insertOne({title: '어쩌구'})
    response.send('오늘 비옴')
})

router.get('/about', (request,response)=>{
    response.sendFile(__dirname+'/myself.html')
})

router.get('/time',(requset, response)=>{
    var time = new Date().toTimeString().split(" ")[0]
    response.render('time.ejs',{time: time})
})

router.get('/abc',(requset,response)=>{
    console.log('안녕')
    console.log(requset.query)//--requset.query는 ?뒤에 붙는 데이터를 가져옴
})

module.exports = router