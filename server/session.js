const session = require('koa-session')
const config={
    key: 'koa:sess',
    maxAge: 86400000,
    overwrite: true,
    httpOnly: true,
    signed: true,
    rolling: false,
    renew: false,
}
exports.session=function(app){
    app.keys = ['sserthulove']
    return session(config,app)
}