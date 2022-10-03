const jwt = require('jsonwebtoken')
const config = require('./config')
const sql = require('./sql')

function addToken(json_data) {
    return jwt.sign(json_data, config.jwt_pwd, { expiresIn: config.jwt_passTime })
}


function getToken(token) {
    // 验证token后刷新token
    let res = null
    try {
        res = jwt.verify(token, config.jwt_pwd)
        if (res["iat"] - 0 > res["exp"] - 0) return null // 过期
    } catch (err) {
        return null // 伪造的token
    }
    newRes = {}
    for (let e in res) {
        if (e != "iat" && e != "exp")
            newRes[e] = res[e]
    }
    return addToken(newRes)
}

function params(token) {
    return jwt.verify(token, config.jwt_pwd)
}

function isAdmin(token) {
    return params(token)["identify"] == 0 
}

function isStu(token) {
    return params(token)["identify"] == 1
}

function isRider(token){
    return params(token)["identify"] == 2
}

function checkTokenInHttp(whiteList) {
    // whiteList = [ {url,method?,reg?} , ]
    // set ctx.myToken

    return async (ctx, next) => {
        // 自定义放行白名单
        for (let i = 0; i < whiteList.length; i++) {
            let p = ctx.request.path
            // 删除可能存在的最后的 /
            //if (p.slice(-1) == "/") p = p.slice(0, -1)
            let w_url = whiteList[i]["url"]
            // 删除可能存在的最后的 /
            //if (w_url.slice(-1) == "/") w_url = w_url.slice(0, -1)
            let match_res = false
            if (whiteList[i]["reg"]) match_res = new RegExp(w_url).test(p)
            else match_res = w_url == p
            if (match_res) {
                if (whiteList[i]["method"]) {// 额外设置了方法
                    if (whiteList[i]["method"] == ctx.request.method) {
                        return await next();
                    } else {
                        break
                    }
                } else {
                    return await next()
                }
            }
        }

        let token = getToken(ctx.request.body["token"])
        if (token == null) {
            return ctx.body = {
                code: 1,
                msg: "token验证错误"
            }
        } else {
            ctx.myToken = token
            //ctx.session.myToken = token
            await next()
        }
    }
}

async function detail(token) {
    let res = await sql.usrInfo(params(token)["usr"])
    return res
}

exports.set = addToken
exports.get = getToken
exports.params = params
exports.isAdmin = isAdmin
exports.isStu = isStu
exports.checkTokenInHttp = checkTokenInHttp
exports.detail = detail
exports.isRider=isRider