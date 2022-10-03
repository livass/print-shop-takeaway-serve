const Koa = require('koa');
const config = require('./server/config')
const Router = require('koa-router')
const bodyparser = require('koa-bodyparser');
const koaBody = require('koa-body');
const jwt = require('koa-jwt')
const send = require('koa-send')
const Token = require('./server/token')
const sql = require('./server/sql')
const cors = require('koa2-cors');
const workCode = require('./server/work_code')
const fs = require('fs')
const path = require('path')
const myZip = require('./server/zip');
const fsm = require('./server/fs_more');
const app = new Koa()
const router = new Router()
const scoreSystem = require('./server/scoreSystem')
const base62x = require('base62x')
const Cache = require('./server/cache');
const { isRegisteredFormat } = require('archiver');
const { Console } = require('console');
const Que = require('./server/que').Que


const cache = Cache.createCache("./cache")
const convert_que = new Que()

// 判断当前是否处理完所有作业
router.get('/handleDone', async (ctx, next) => {
    ctx.body = {
        code: 0,
        done: convert_que.done(),
        left: convert_que.left(),
    }
})

router.get('/login1', async (ctx, next) => {
    ctx.body = "请使用POST方法"
})

router.post('/login1', async (ctx, next) => {
    let usr = ctx.request.body["usr"]
    let pwd = ctx.request.body["pwd"]
    // 处理用户登录
    let usrInfo = await sql.login1(usr, pwd)
    if (usrInfo == false) {
        ctx.body = {
            code: 11,
            msg: "用户名密码不匹配"
        }
        return
    }
    let token = Token.set(usrInfo)
    ctx.response.set('myToken', token)
    ctx.body = {
        code: 0,
        msg: "",
        token: token,
        identify: usrInfo["identify"]
    }
})
//注册用户
router.post('/register',async(ctx,next)=>{
    let usr=ctx.request.body["usr"]
    let pwd=ctx.request.body["pwd"]
    let identify=ctx.request.body["identify"]
    let name=ctx.request.body["name"]
    let address=ctx.request.body["address"]
    let class_list='["润园打印店","沁园打印店","澄园打印店","泽园打印店"]'
    identify=parseInt(identify)
    let res=await sql.register(usr,pwd,identify,name,address,class_list)
    if(res==false){
        return ctx.body={
            code:12,
            msg:"注册失败"
        }
    }
    else{
        return ctx.body={
            code:0,
            msg:"注册成功"
        }
    }
})



// 发布作业
router.post('/publish_assignments', async (ctx, next) => {
    if (Token.isAdmin(ctx.myToken) == false) {
        // 不为admin
        return ctx.body = {
            code: 2,
            msg: "权限错误"
        }
    }
    let work_name = ctx.request.body["work_name"]
    let work_desc = ctx.request.body["work_desc"]
    let work_deadline = ctx.request.body["work_deadline"]
    let work_class = ctx.request.body["work_class"]
    if (!work_name) {
        return ctx.body = {
            code: 21,
            msg: "作业名不为空"
        }
    }
    if (!work_class) {
        return ctx.body = {
            code: 25,
            msg: "作业所属班级为空"
        }
    }
    let work_belong = Token.params(ctx.myToken)["usr"]
    // 判断当前用户是否有权限创建属于这个班级的作业
    let class_list = (await sql.usrInfo(work_belong))["class_list"]
    if (class_list.some((v) => v == ctx.request.body["work_class"]) == false) {
        return ctx.body = {
            code: 26,
            token: ctx.myToken
        }
    }
    let work_code = workCode.encode(work_name, work_belong)
    let res = await sql.addWork(work_code, work_name, work_belong, work_desc, work_deadline, work_class)
    if (res == false) {
        return ctx.body = {
            code: 22,
            msg: "作业码生成失败，请稍后重试"
        }
    }
    // 发布作业成功
    return ctx.body = {
        code: 0,
        token: ctx.myToken,
        work_code: work_code
    }
})


// 删除发布的作业
router.post('/delete_assignments', async (ctx, next) => {


    let work_code = ctx.request.body["work_code"]
    // mark to del
    if (work_code == "Uo9tRt9hNsvXRMKYEYBfd83ciOBbY8Rcdf0jvfoVvBYjvBsSvBYQ8YmYTsx1oQrx1YPMnlRcSYEY9uUdaYB29tRt9hNtHfRMKYEZ4sC3CuC38nEJOpCJDx1") {
        return ctx.body = {
            code: -1
        }
    }
    if (work_code == null) {
        return ctx.body = {
            code: 23,
            msg: "作业码解析失败"
        }
    }

    let work_code_belong = workCode.decode(work_code)["work_belong"]
    let usr = Token.params(ctx.myToken)["usr"]
    if (work_code_belong != usr) {
        return ctx.body = {
            code: 2,
            msg: "只有此作业发布者才能删除作业"
        }
    }
    if (await sql.delWork(work_code) == true) {
        return ctx.body = {
            code: 0,
            token: ctx.myToken
        }
    } else {
        return ctx.body = {
            code: 3,
            msg: "不存在此作业码（未创建或已被删除）",
            token: ctx.myToken
        }
    }
})


// 上传作业
// !!! .docx only
router.post('/submit_work', async (ctx, next) => {
    let work_code = ctx.request.body["work_code"]
    let usr=ctx.request.body["usr"]
    if (work_code == null || (await sql.haveWork(work_code)) == false) {
        return ctx.body = {
            code: 23,
            msg: "作业码不存在",
            token: ctx.myToken
        }
    }
    // 判断提交的文件是否超时
    //获取信息
    let work_detail = await sql.getWorkDetailsByWorkCode(work_code)
    let work_name=work_detail["work_name"]
    let work_belong=work_detail["work_class"]
    let work_class=work_detail["work_class"]
    let deadline = work_detail["work_deadline"] - 0
    let usr_detail=await sql.getusrdetailbyusr(usr)
    let usr_id=usr_detail["usr"]
    let usr_address=usr_detail["address"]
    if ((deadline) && (deadline - new Date().getTime() < 0)) {
        return ctx.body = {
            code: 24,
            msg: "此打印服务存在截止时间且上传时间已截止",
            token: ctx.myToken
        }
    }
    let usrInfo = Token.params(ctx.myToken)
    // 判断当前用户是否有权限创建属于这个班级的作业
    let class_list = (await sql.usrInfo(usrInfo.usr))["class_list"]
    if (class_list.some((v) => v == work_detail["work_class"]) == false) {
        return ctx.body = {
            code: 26,
            token: ctx.myToken,
            msg: "当前用户不在此班级，无法操作此作业"
        }
    }
    // const file = ctx.request.files.file
    // if (!file) return ctx.body = {
    //     code: 41,
    //     token: ctx.myToken
    // }

    const files = ctx.request.files.file
    if (!files) return ctx.body = {
        code: 41,
        token: ctx.myToken
    }

    //创建成绩表记录 成绩初始为-2表示学生未提交作业，详见readme/作业分数说明
    await scoreSystem.setScoreByWorkCode(work_code, [{ usr: usrInfo.usr, score: -1 }])
    // 覆盖提交 会先删除当前用户之前创建的文件夹及子文件
    
    if (fs.existsSync(path.join('./', 'work', work_code, usrInfo["usr"]))) {
        fsm.rm_rf(path.join('./', 'work', work_code, usrInfo["usr"]))
    }
    // 重新创建用户文件夹
    fs.mkdirSync(path.join('./', 'work', work_code, usrInfo["usr"]))
    //写入文件
    let f_ = []
    try {
        for (let file of files) {
            f_.push(file)
        }
    } catch (ex) {
        f_.push(files)
    }
    for (let file of f_) {
        // 提交后的文件操作
        let reader = fs.createReadStream(file.path)
        let fileExtName = path.extname(file.name).toLowerCase()
        // 判别是否为word或pdf
        if (fileExtName == ".docx" || fileExtName == ".doc" || fileExtName == ".pdf") {
            //上传附件
            let filePath = path.join('./', 'work', work_code, usrInfo["usr"], file.name)
            const upStream = fs.createWriteStream(filePath)
            reader.pipe(upStream)
        }
        else{
            return ctx.body = {
                code: 43,
                msg: "上传文件不为word和pdf!",
                token: ctx.myToken
            }
        }
    }
        /*
        else {
            // 转换word
            // 重命名!!!
            let baseName = (await sql.generateFileName(usrInfo["usr"], work_code))
            let fileName = baseName + fileExtName
            let filePath = path.join('./', 'work', work_code, usrInfo["usr"], fileName)
            let upStream = fs.createWriteStream(filePath)
            reader.pipe(upStream)
            // word 转 pdf
            //let pdfURL = await fsm.wordToPdf(filePath)
            // let pdfURL = await convert_que.addSync(async () => await fsm.wordToPdf(filePath))
           
           let pdfURL = ""
            const delayRun = async (filePath, pdfURL, usrInfo, work_detail) => {
                pdfURL = await convert_que.addSync(async () => await fsm.wordToPdf(filePath))
                // 删除原先的word文稿
                //fs.unlinkSync(filePath)
                // 加水印
                //let pdfName = path.resolve(path.dirname(filePath), path.basename(filePath).replace(/\..+$/, ".pdf"))
                let uniqueMark = base62x.encode(path.basename(pdfURL))
                // 生成封面文件
                let fengmianPDF = await fsm.generatePdfCover(
                    `./__genPdf${uniqueMark}.pdf`,
                    usrInfo["usr"],
                    usrInfo["name"],
                    work_detail["work_class"],
                    //work_detail["no"]
                )
                // 合并pdf
                let catPdf = await fsm.catPdf(`./__catPDF${uniqueMark}.pdf`, fengmianPDF, pdfURL)
                // 添加水印
                let watermarkText = cache.get("watermarkText") || `  
                    ${usrInfo["usr"]}_${usrInfo["name"]}
                    `
                let donPdf = await fsm.pdfAddWatermark(catPdf, watermarkText, `./__finalPdf${uniqueMark}.pdf`)
                fs.unlink(fengmianPDF, () => { })
                fs.unlink(catPdf, () => { })
                fs.renameSync(donPdf, pdfURL)
            }

            // quick_submit 开关判断
            let quick_submit = ctx.request.body["quick_submit"] || false
            if (quick_submit) {
                // 启用快速上传
                setTimeout(((filePath, pdfURL, usrInfo, work_detail) => { return () => { delayRun(filePath, pdfURL, usrInfo, work_detail) } })(filePath, pdfURL, usrInfo, work_detail), 0)
            } else {
                // 常规上传
                await delayRun(filePath, pdfURL, usrInfo, work_detail)
            }
        }
           
    }
    
     */
    //检查是否提交过
    let res1=await sql.getorderbyusrandworkcode(usr,work_code)
    if(res1){
        return ctx.body = {
            code: 101,
            msg: "已经存在订单，想要上传新文件，请取消原来订单"
        }
    }

    let ifdelivery=0
    let res=await sql.getorder(usr_id,work_belong,work_class,work_name,ifdelivery,work_code,usr_address)
    if(res==false){
        return ctx.body = {
            code: 44,
            msg: "订单生成失败"
        }
    }

    return ctx.body = {
        code: 0,
        msg: "上传成功！",
        token: ctx.myToken
    }

})

// 下载作业
router.post('/download_assignments', async (ctx, next) => {
    let work_code = ctx.request.body["work_code"]
    // mark to del
    // if (work_code == "Uo9tRt9hNsvXRMKYEYBfd83ciOBbY8Rcdf0jvfoVvBYjvBsSvBYQ8YmYTsx1oQrx1YPMnlRcSYEY9uUdaYB29tRt9hNtHfRMKYEZ4sC3CuC38nEJOpCJDx1") {
    //     return ctx.body = {
    //         code: -1
    //     }
    // }
    if (work_code == null || (await sql.haveWork(work_code)) == false) {
        return ctx.body = {
            code: 23,
            msg: "作业码不存在",
            token: ctx.myToken
        }
    }
    let usrInfo = Token.params(ctx.myToken)
    if ((await sql.canDownload(work_code, usrInfo["identify"])) == false) {
        return ctx.body = {
            code: 2,
            msg: "没有权限获取文件下载地址",
            token: ctx.myToken
        }
    }
    let download_url = (await myZip.zipAndDownload(work_code))()
    return ctx.body = {
        code: 0,
        token: ctx.myToken,
        download_url: download_url
    }
})

// 下载打印服务附件
router.post('/download_assignments_plus', async (ctx, next) => {
    let work_code = ctx.request.body["work_code"]
    let usr = ctx.request.body["usr"] || ""
    let usrInfo = Token.params(ctx.myToken)
    if (Token.isAdmin(ctx.myToken) == false && usr != usrInfo["usr"]) return ctx.body = {
        code: 2,
        msg: "权限不足",
        token: ctx.myToken,
    }
    if (work_code == null || (await sql.haveWork(work_code)) == false) {
        return ctx.body = {
            code: 23,
            msg: "作业码不存在",
            token: ctx.myToken
        }
    }

    let download_url = (await myZip.zipByFolder(work_code, usr))()
    return ctx.body = {
        code: 0,
        token: ctx.myToken,
        download_url: download_url
    }
})


// 获取已发布的服务列表
router.post('/get_published_assignments_list', async (ctx, next) => {
    if (Token.isAdmin(ctx.myToken) == false) {
        return ctx.body = {
            code: 2,
            msg: "权限不足",
            token: ctx.myToken,
            work_list: []
        }
    }
    let work_belong = Token.params(ctx.myToken)["usr"]
    let res = await sql.getWorkListByWorkBelong(work_belong)
    ctx.body = {
        code: 0,
        token: ctx.myToken,
        work_list: res
    }
})

// 获取详细服务
router.post('/get_assignments_detail', async (ctx, next) => {
    let work_code = ctx.request.body["work_code"]
    console.log(work_code)
    if (!work_code) return ctx.body = {
        code: 4
    }
    let stuList = []
    if (Token.isAdmin(ctx.myToken)) {
        // 若是老师身份则额外返回学生列表
        stuList = await sql.getorderByWorkCode(work_code)
        let ScoreListAns = await scoreSystem.getScoreByWorkCode(work_code)
        stuList = await Promise.all(stuList.map(async (v) => {
            let res=await sql.getorderidbyname(v,work_code)
            let tmpAns = await scoreSystem.getScoreDetail(work_code, v, ScoreListAns)
            return {
                usr: v,
                id:res["porder_id"],
                ifdelivery:res["ifdelivery"],
                score: tmpAns["score"],
                remark: tmpAns["remark"] || "",
                submitStat: (tmpAns["score"] - 0) >= -1,
            }
        }))
    }
    let res = await sql.getWorkDetailsByWorkCode(work_code)
    ctx.body = {
        code: 0,
        token: ctx.myToken,
        work_name: res["work_name"] || "",
        work_belong: res["work_belong"],
        work_desc: res["work_desc"],
        class: res["work_class"],
        work_deadline: res["work_deadline"],
        stu_list: stuList,
    }
})

// 修改密码
router.post('/reset_password', async (ctx, next) => {
    let newPwd = ctx.request.body["newPwd"]
    let usrInfo = Token.params(ctx.myToken)
    let usr = ctx.request.body["usr"] || usrInfo["usr"]
    let msg = ""
    if (usrInfo["usr"] == usr) {
        // 当前用户修改密码
        msg = await sql.resetPassword(usr, newPwd)
    } else if ((await sql.isAdminByUsr(usr)) == false
        && token.isAdmin(ctx.myToken) == true) {
        // 管理员修改非管理员密码
        msg = await sql.resetPassword(usr, newPwd)
    } else {
        return ctx.body = {
            token: ctx.myToken,
            code: 2,
            msg: "当前权限组无法修改目标用户密码"
        }
    }
    return ctx.body = {
        token: ctx.myToken,
        code: 0,
        msg: msg
    }

})

// 获取打印店列表
router.post('/get_class_list', async (ctx, next) => {
    let usrInfo = Token.params(ctx.myToken)
    let class_list = await sql.getClassList(usrInfo["usr"])
    return ctx.body = {
        token: ctx.myToken,
        code: 0,
        class_list: JSON.parse(class_list)
    }
})

router.post('/get_assignments_list_by_class', async (ctx, next) => {
    let work_class = ctx.request.body["class"]
    let usrInfo = await Token.detail(ctx.myToken)
    if (usrInfo["class_list"].some((v) => v == work_class) == false) {
        return ctx.body = {
            token: ctx.myToken,
            code: 26
        }
    }
    let work_list = await sql.getAssignmentsListByClass(work_class)
    return ctx.body = {
        token: ctx.myToken,
        code: 0,
        work_list: work_list
    }
})



router.post('/get_guy_info', async (ctx, next) => {
    let usrInfo = await Token.detail(ctx.myToken)
    delete (usrInfo["pwd"])
    let target = ctx.request.body["usr"]
    if (usrInfo["identify"] == 1) {
        // 学生
        return ctx.body = {
            token: ctx.myToken,
            code: 2,
            info: usrInfo
        }
    } else if (usrInfo["identify"] == 0) {
        // 老师
        if (!target) return ctx.body = {
            code: 11,
            token: ctx.myToken,
            msg: "待查寻usr为空"
        }
        usrInfo = await sql.usrInfo(target)
        delete (usrInfo["pwd"])
        return ctx.body = {
            token: ctx.myToken,
            code: 0,
            info: usrInfo
        }
    } else {
        // 未知身份
    }
    return ctx.body = {
        token: ctx.myToken,
        code: 0,

    }
})

router.post('/preview_assignment', async (ctx, next) => {
    // !!!
    let usrInfo = await Token.detail(ctx.myToken)
    let target = ctx.request.body["usr"]
    let work_code = ctx.request.body["work_code"]
    // // mark to del
    // if (usrInfo["identify"] == 0 && work_code == "Uo9tRt9hNsvXRMKYEYBfd83ciOBbY8Rcdf0jvfoVvBYjvBsSvBYQ8YmYTsx1oQrx1YPMnlRcSYEY9uUdaYB29tRt9hNtHfRMKYEZ4sC3CuC38nEJOpCJDx1") {
    //     return ctx.body = {
    //         code: -1
    //     }
    // }
    if (usrInfo["identify"] == 1) {
        // 学生
        target = usrInfo["usr"]
    }
    if (!target || !work_code) return ctx.body = {
        code: 4,
        token: ctx.myToken,
        msg: "上传参数错误"
    }
    // assert(pdf only)
    let p = ("./work/" + work_code + "/" + target + "/")
    let pp = Array.from(fsm.listFile(p)).filter(v => /\.pdf$/.test(v))
    if (pp.length == 0) {
        pp = Array.from(fsm.listFile(p)).filter(v => /\.docx?$/.test(v))
        if (pp.length == 0) return ctx.body = {
            code: 51,
            token: ctx.myToken
        }
    }
    p = pp[0]
    let tmpDownloadUrl = path.join("public/tmp/", path.basename(p))
    fs.copyFileSync(p, tmpDownloadUrl)
    // setTimeout(() => {
    //     try{fs.unlinkSync(tmpDownloadUrl)}
    //     catch(ex){}
    // }, 1000 * 60 * 10) // 10 min
    return ctx.body = {
        code: 0,
        token: ctx.myToken,
        url: tmpDownloadUrl.replace("public", "")
    }
})

router.post('/grade_assignments', async (ctx, next) => {
    // 验证老师身份
    // !!!
    //let usrInfo = await Token.detail(ctx.myToken)
    if (Token.isAdmin(ctx.myToken) == false) {
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    let work_code = ctx.request.body["work_code"]
    let updateTarget = ctx.request.body["updateTarget"]
    await scoreSystem.setScoreByWorkCode(work_code, updateTarget)
    return ctx.body = {
        code: 0,
        token: ctx.myToken
    }
})

router.post('/get_score', async (ctx, next) => {
    // !!! 权限配置！！！
    let usr = ctx.request.body["usr"]
    let work_code = ctx.request.body["work_code"]
    let usrInfo = await Token.detail(ctx.myToken)
    if (Token.isAdmin(ctx.myToken) == false && usrInfo["usr"] != usr) {
        return ctx.body = {
            code: 2
        }
    }
    let ans = await scoreSystem.getScoreDetail(work_code, usr)
    return ctx.body = {
        code: 0,
        score_detail: ans,
        token: ctx.myToken
    }
})

router.post('/get_stu_usr_by_workcode', async (ctx, next) => {
    if (Token.isAdmin(ctx.myToken) == false) {
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    let work_code = ctx.request.body["work_code"]
    let list = await sql.getStuByWorkCode(work_code)
    return ctx.body = {
        code: 0,
        list: list,
        token: ctx.myToken
    }
})

router.post('/oops', async (ctx, next) => {
    // 上传多个文件
    const files = ctx.request.files.file; // 获取上传文件
    for (let file of files) {
        // 创建可读流
        const reader = fs.createReadStream(file.path);
        // 获取上传文件扩展名
        let filePath = path.join(__dirname, 'public/upload/') + `/${file.name}`;
        // 创建可写流
        const upStream = fs.createWriteStream(filePath);
        // 可读流通过管道写入可写流
        reader.pipe(upStream);
    }
    return ctx.body = "上传成功！";
});
/**
 * 自定义水印
 * text
 */
router.post('/watermark_text', async (ctx, next) => {
    if (Token.isAdmin(ctx.myToken) == false) {
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    let txt = ctx.request.body["text"] || ""
    cache.set({ watermarkText: txt })
    return ctx.body = {
        code: 0,
        token: ctx.myToken
    }
})
router.post('/watermark_text_get', async (ctx, next) => {
    if (Token.isAdmin(ctx.myToken) == false) {
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    return ctx.body = {
        code: 0,
        token: ctx.myToken,
        text: cache.get("watermarkText")
    }
})

//获取订单
router.post('/get_alludorder_list', async (ctx, next) => {
    if (Token.isAdmin(ctx.myToken)) {
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    let order_list = await sql.getUndlOrders()
    return ctx.body={
        token: ctx.myToken,
        code: 0,
        order_list:order_list
    }
})

//获取自己抢的订单
router.post('/get_youorder_list', async(ctx,next)=>{
    if(Token.isAdmin(ctx.myToken)){
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    let usr=ctx.request.body["usr"]
    let order_list=await sql.getyouhaveorders(usr)
    return ctx.body={
        token: ctx.myToken,
        code: 0,
        order_list:order_list
    }
})

//配送员抢此订单
router.post('/rider_get_thisorder',async(ctx,next)=>{
    let order_id=ctx.request.body["order_id"]
    let delivery_rider=ctx.request.body["usr"]
    if(!Token.isRider(ctx.myToken)){
        return ctx.body={   
            code:2,
            token:ctx.myToken
        }
    }
    let order_detail=await sql.getorderbyorder_id(order_id)
    let delivery_get=order_detail["porder_put"]
    let delivery_address=order_detail["usr_address"]
    let delivery_point=order_detail["porder_address"]
    let res1 =await sql.ifdeliveryyes(order_id)
    if(res1==false){
        return ctx.body = {
            code: 6,
            msg: "更新失败"
        }
    }
    let res=await sql.getdelivery(delivery_get,delivery_rider,delivery_address,order_id,delivery_point)
    if(res==false){
        return ctx.body = {
            code: 3,
            msg: "插入失败"
        }
    }
    return ctx.body = {
        code: 0,
        msg: "上传成功！",
        token: ctx.myToken
    }
})

//配送员放弃订单
router.post('/rider_giveup_order',async(ctx,next)=>{
    if(!Token.isRider(ctx.myToken)){
        return ctx.body={   
            code:2,
            token:ctx.myToken
        }
    }
    let order_id=ctx.request.body["order_id"]
    let res1=await sql.ifdeliveryno(order_id)
    if(res1==false){
        return ctx.body={
            code: 6,
            msg: "更新失败"
        }
    }
    let res2=await sql.deldeliveryourder(order_id)
    if(res2==false){
        return ctx.body={
            code: 6,
            msg: "删除失败"
        }
    }
    return ctx.body = {
        code: 0,
        msg: "上传成功！",
        token: ctx.myToken
    }
})

//用户查看自己的订单详情
router.post('/usrcheckorder',async(ctx,next)=>{
    if(!Token.isStu(ctx.myToken)){
        return ctx.body={   
            code:2,
            token:ctx.myToken
        }
    }
    let usr=ctx.request.body["usr"]
    let work_code=ctx.request.body["work_code"]
    let order_list=await sql.getorderbyusr(usr,work_code)
    return ctx.body={
        code:0,
        token:ctx.myToken,
        order_list:order_list
    }
})

//用户通过打印店来查看
router.post('/get_orderbyuac',async(ctx,next)=>{
    if(!Token.isStu(ctx.myToken)){
        return ctx.body={   
            code:2,
            token:ctx.myToken
        }
    }
    let usr=ctx.request.body["usr"]
    let porder_get=ctx.request.body["porder_get"]
    let order_list=await sql.getorderbyuac(usr,porder_get)
    return ctx.body={
        code:0,
        token:ctx.myToken,
        order_list:order_list
    }
})

//用户取消订单
router.post('/del_order',async(ctx,next)=>{
    if(!Token.isStu(ctx.myToken)){
        return ctx.body={   
            code:2,
            token:ctx.myToken
        }
    }
    let order_id=ctx.request.body["order_id"]
    let res1=await sql.deldeliveryourder(order_id)
    if(res1==false){
        return ctx.body={   
            code:3,
            token:ctx.myToken
        }
    }
    let res2=await sql.delprintorderourder(order_id)
    if(res2==false){
        return ctx.body={   
            code:3,
            token:ctx.myToken
        }
    }
    return ctx.body={
        code:0,
        token:ctx.myToken,
        msg:'成功'
    }
})

//获取打印店订单
router.post('/get_allshopudorder_list', async (ctx, next) => {
    if (Token.isAdmin(ctx.myToken)) {
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    let porder_address=ctx.request.body["porder_address"]
    let order_list = await sql.getUndlOrdersbyshop(porder_address)
    return ctx.body={
        token: ctx.myToken,
        code: 0,
        order_list:order_list
    }
})

//获取已抢打印店订单
router.post('/get_shopyouorder_list', async(ctx,next)=>{
    if(Token.isAdmin(ctx.myToken)){
        return ctx.body = {
            code: 2,
            token: ctx.myToken
        }
    }
    let usr=ctx.request.body["usr"]
    let address=ctx.request.body["address"]
    let order_list=await sql.getshopyouhaveorders(usr,address)
    return ctx.body={
        token: ctx.myToken,
        code: 0,
        order_list:order_list
    }
})

app.use(cors({
    credentials: true,//默认情况下，Cookie不包括在CORS请求之中。设为true，即表示服务器许可Cookie可以包含在请求中
    origin: ctx => ctx.header.origin, // web前端服务器地址，注意这里不能用*
}))
app.use(jwt({ secret: config.jwt_pwd, passthrough: true }).unless({ path: ["/login1"] }));
app.use(koaBody({
    multipart: true,
    formidable: {
        maxFileSize: 50 * 100 * 1024 * 1024,    // 设置上传文件大小最大限制，默认50M
        multipart: true,
    }
}));
app.use(bodyparser());
app.use(Token.checkTokenInHttp([
    { url: "^/login1/?$", method: "POST", reg: true },
    { url: "^/register/?$", method: "POST", reg: true },
    { url: "^/handleDone/?$", reg: true },
    { url: "^/tmp(/.*)?$", reg: true },
]))
app.use(require('koa-static')(path.join('./public')))
app.use(router.routes()).use(router.allowedMethods());
app.listen(config.port,() =>console.log('ok'))
