let router = require('express').Router()

//--미들웨어(변수 3개 필요) []로 미들웨어 함수 여러개 넣을 수 있다
function loginChk(request, response, next){
    if(!request.user){
        response.send("<script>alert('로그인하세요');location.href='/login'</script>")
    }
    else next()//--미들웨어 실행 끝나고 다음으로 이동
}

router.get('/sports', loginChk, (requeset,response)=>{
    response.send('스포츠 게시판')
})

router.get('/game', loginChk, (requeset,response)=>{
    response.send('게임 게시판')
})

module.exports = router