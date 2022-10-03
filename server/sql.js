const mysql = require('mysql')
const config = require('./config')
const fs = require('fs')
const path = require('path')
const workCode = require('./work_code')
const fsm = require('./fs_more')
const connection = mysql.createConnection(config.sql)
connection.connect()

async function query(sql, list) {
    return new Promise((resolve, reject) => {
        connection.query(sql, list, (err, res) => {
            if (err) return reject(err)
            return resolve(JSON.parse(JSON.stringify(res)))
        })
    })
}

async function login(usr, pwd) {
    let res = await query(
        "select * from login1 where usr=? and pwd=? limit 1;",
        [usr, pwd]
    )
    if (res.length == 0) {
        // have no match
        return false
    } else {
        return res[0]
    }

}

async function isAdminByUsr(usr) {
    let res = await query(
        "select identify from login1 where usr=?;",
        [usr]
    )
    return res.length == 0 ? false : res[0]["identify"] == 0
}

async function addWork(work_code, work_name, work_belong, work_desc, work_deadline, work_class) {
    //let no = (await query("select count(*) as num from work where work_class=?", [work_class]))[0]["num"] - 0 + 1;
    let res = []
    try {
        res = await query(
            "insert into work(work_code,work_name,work_belong,work_desc,work_deadline,work_class) values(?,?,?,?,?,?);",
            [work_code, work_name, work_belong, work_desc, work_deadline, work_class]
        )
        await query("insert into score(work_code) values(?)", [work_code])
    } catch (err) { console.log(err); return false }
    if (res.length == 0) { // 已有此作业
        return false
    }
    // 生成对应文件夹
    fs.mkdirSync(path.resolve('./work', work_code))
    return true
}

async function haveWork(work_code) {
    let res = await query("select * from work where work_code=?;", [work_code])
    return res.length != 0
}

async function delWork(work_code) {
    if ((await haveWork(work_code)) == false) return false
    let res = await query("delete from work where work_code=?;", [work_code])
    //await query("delete from score where work_code=?", [work_code])
    res = fsm.rm_rf(path.resolve('work/', work_code))
    return res
}

async function canDownload(work_code, work_belong) {
    let res = await query("select * from work where work_code=? and work_belong=?;", [work_code, work_belong])
    return res.length != 0
}

async function getWorkListByWorkBelong(work_belong) {
    let res = await query("select work_code,work_name from work where work_belong=?", [work_belong])
    return res
}

async function getWorkDetailsByWorkCode(work_code) {
    let res = await query("select * from work where work_code=? limit 1;", [work_code])
    return res.length == 0 ? null : Array.from(res)[0]
}


async function resetPassword(usr, newPwd) {
    let res = await query(
        "update login1 set pwd=? where usr=?;",
        [newPwd, usr]
    )
    return res["message"]
}

async function getClassList(usr) {
    let res = await query(
        "select class_list from login1 where usr=?;",
        [usr]
    )
    res = Array.from(res)[0]["class_list"]
    return res
}

async function getAssignmentsListByClass(work_class) {
    let res = await query(
        "select work_code,work_name from work where work_class=?;",
        [work_class]
    )
    res = Array.from(res)
    return res
}


async function usrInfo(usr) {
    let res = await query(
        "select * from login1 where usr=?",
        [usr]
    )
    res = Array.from(res)[0]
    // 处理 class_list 列表
    if (res["class_list"]) {
        res["class_list"] = (JSON.parse(res["class_list"]))
    }
    return res
}

async function generateFileName(usr, work_code) {
    let format = []
    let info = await usrInfo(usr);
    format.push(info["usr"])
    format.push(info["name"])
    info = await getWorkDetailsByWorkCode(work_code)
    format.push(info["work_class"])
    //format.push(info["no"])
    return (format.join("_"))
}

//获取此服务所有学生
async function getStuByWorkCode(work_code) {
    let list = []
    let work_class = await query("select work_class from work where work_code=?", [work_code])
    if (work_class.length == 0) return list
    work_class = work_class[0]["work_class"]
    console.log(work_class)
    let stuArr = await query("select usr from login1 where identify='1' and class_list like ?;", [`%\"${work_class}\"%`])
    stuArr = stuArr.map(v => v["usr"])
    return stuArr
}

//登录1
async function login1(usr, pwd) {
    let res = await query(
        "select * from login1 where usr=? and pwd=? limit 1;",
        [usr, pwd]
    )
    if (res.length == 0) {
        // have no match
        return false
    } else {
        return res[0]
    }
}

//注册用户
async function register(usr,pwd,identify,name,address,class_list){
    let res = []
    try {
        res = await query(
            "insert into login1(usr,pwd,identify,name,address,class_list) values(?,?,?,?,?,?);",
            [usr,pwd,identify,name,address,class_list]
        )
    } catch (err) { console.log(err); return false }
    if (res.length == 0) { // 已有此账号
        return false
    }
    else 
        return true
}



//生成订单
async function getorder(porder_put,porder_get,porder_address,porder_work,ifdelivery,work_code,usr_address){
    let res=[]
    try{
        res=await query(
            "insert into printorder(porder_put,porder_get,porder_address,porder_work,ifdelivery,work_code,usr_address) values(?,?,?,?,?,?,?);",
            [porder_put,porder_get,porder_address,porder_work,ifdelivery,work_code,usr_address]
        )
    }catch(err){console.log(err);return false}
    if(res.length==0){
        return false
    }
    else 
        return true
}

//获取学生用户详情
async function getusrdetailbyusr(usr) {
    let res = await query("select * from login1 where usr=? limit 1;", [usr])
    return res.length == 0 ? null : Array.from(res)[0]
}

//获取此服务所有订单的账号
async function getorderByWorkCode(work_code) {
    let list = []
    let work_class = await query("select work_class from work where work_code=?", [work_code])
    if (work_class.length == 0) return list
    work_class = work_class[0]["work_class"]
    console.log(work_class)
    let stuArr = await query("select porder_put from printorder where work_code =?;", [work_code])
    stuArr = stuArr.map(v => v["porder_put"])
    return stuArr
}

//获取订单详情
async function getorderidbyname(usr,work_code) {
    let res = await query("select * from printorder where porder_put=? and work_code=?;", [usr,work_code])
    return res.length == 0 ? null : Array.from(res)[0]
}

//获取没有抢购的订单
async function getUndlOrders() {
    let res = await query(
        "select porder_id,porder_put,porder_address,porder_work,usr_address from printorder where ifdelivery=0;" 
    )
    res = Array.from(res)
    return res
}

//获取本人抢的订单
async function getyouhaveorders(delivery_rider){
    let res = await query(
        "select delivery_get,delivery_address,order_id,delivery_point from delivery where delivery_rider=?;",[delivery_rider])
    res = Array.from(res)
    return res
}

//通过订单号获取订单详情
async function getorderbyorder_id(order_id){
    let res=await query("select * from printorder where porder_id=?;",[order_id])
    return res.length==0?null:Array.from(res)[0]
}

//更新配送数据=1
async function ifdeliveryyes(order_id){
    await query("update printorder set ifdelivery=1 where porder_id=?;",[order_id])
}

//更新配送数据=0
async function ifdeliveryno(order_id){
   let res= await query("update printorder set ifdelivery=0 where porder_id=?;",[order_id])
   return res.length==0?false:true
}

//配送表数据插入
async function getdelivery(delivery_get,delivery_rider,delivery_address,order_id,delivery_point){
    let res=[]
    try{
        res=await query(
            "insert into delivery(delivery_get,delivery_rider,delivery_address,order_id,delivery_point) values(?,?,?,?,?);",
            [delivery_get,delivery_rider,delivery_address,order_id,delivery_point]
        )
    }catch(err){console.log(err);return false}
    if(res.length==0){
        return false
    }
    else 
        return true
}

//删除已有订单
async function deldeliveryourder(order_id) {
    let res = await query("delete from delivery where order_id=?;", [order_id])
    return res
}

//获取用户订单
async function getorderbyusr(usr,work_code){
    let res = await query("select porder_id,porder_work,ifdelivery from printorder where porder_put=? and work_code=?;", [usr,work_code])
    res = Array.from(res)
    return res
}

//通过用户和打印店获取订单
async function getorderbyuac(porder_put,porder_get){
    let res=await query("select porder_id,porder_work,ifdelivery from printorder where porder_put=? and porder_get=?;",[porder_put,porder_get])
    res = Array.from(res)
    return res
}

//删除订单
async function delprintorderourder(order_id) {
    let res = await query("delete from printorder where porder_id=?;", [order_id])
    return res
}

//检查是否提交过文件
async function getorderbyusrandworkcode(usr,work_code){
    let res=await query("select * from printorder where porder_put=? and work_code=?;",[usr,work_code])
    return res.length==0?null:Array.from(res)[0]
}

//通过打印店获取订单
async function getUndlOrdersbyshop(porder_address) {
    let res = await query(
        "select porder_id,porder_put,porder_address,porder_work,usr_address from printorder where ifdelivery=0 and porder_address=?;",
        [porder_address] 
    )
    res = Array.from(res)
    return res
}

//通过打印店获得已抢订单
async function getshopyouhaveorders(delivery_rider,delivery_point){
    let res = await query(
        "select delivery_get,delivery_address,order_id,delivery_point from delivery where delivery_rider=? and delivery_point=?;",
        [delivery_rider,delivery_point])
    res = Array.from(res)
    return res
}



exports.query = query
exports.login = login
exports.addWork = addWork
exports.delWork = delWork
exports.haveWork = haveWork
exports.canDownload = canDownload
exports.getWorkListByWorkBelong = getWorkListByWorkBelong
exports.getWorkDetailsByWorkCode = getWorkDetailsByWorkCode
exports.isAdminByUsr = isAdminByUsr
exports.resetPassword = resetPassword
exports.getClassList = getClassList
exports.getAssignmentsListByClass = getAssignmentsListByClass
exports.usrInfo = usrInfo
exports.generateFileName = generateFileName
exports.getStuByWorkCode = getStuByWorkCode
exports.login1 = login1
exports.register= register
exports.getorder= getorder
exports.getusrdetailbyusr= getusrdetailbyusr
exports.getorderByWorkCode=getorderByWorkCode
exports.getorderidbyname=getorderidbyname
exports.getUndlOrders=getUndlOrders
exports.getorderbyorder_id=getorderbyorder_id
exports.ifdeliveryyes=ifdeliveryyes
exports.ifdeliveryno=ifdeliveryno
exports.getdelivery=getdelivery
exports.deldeliveryourder=deldeliveryourder
exports.getyouhaveorders=getyouhaveorders
exports.getorderbyusr=getorderbyusr
exports.getorderbyuac=getorderbyuac
exports.delprintorderourder=delprintorderourder
exports.getorderbyusrandworkcode=getorderbyusrandworkcode
exports.getUndlOrdersbyshop=getUndlOrdersbyshop
exports.getshopyouhaveorders=getshopyouhaveorders