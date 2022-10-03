//端口号
const port=3000
exports.port=port

// jwt-secret
const jwt_pwd="sgredrst43t"
exports.jwt_pwd=jwt_pwd
// jwt-过期时间
const jwt_passTime='30m' // 30 min
exports.jwt_passTime=jwt_passTime


// 数据库
const sql={
    host:'localhost',
    user:'root',
    password:'111111',
    database:'server'
}
exports.sql=sql