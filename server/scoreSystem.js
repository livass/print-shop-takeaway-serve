const query = require('./sql').query

async function getScoreByWorkCode(work_code) {
    let ans = await query("select json from score where work_code=? limit 1;", work_code)
    if (ans.length == 0) return null;
    return JSON.parse(ans[0]["json"])
}
async function getScoreDetail(work_code, usr, handledScoreList) {
    // handledScorelList 用于缓存getScoreByWorkCode()的返回结果ans
    let ans = []
    if (handledScoreList) ans = handledScoreList
    else ans = await getScoreByWorkCode(work_code)
    if (!(usr in ans)) return { score: -3 }
    if (!("score" in ans[usr])) ans[usr]["score"] = -2 // score 不存在说明学生未提交作业
    return ans[usr]
}
//setScoreByWorkCode("Uo9tRt9hNsvXRMKYEY8nCJ8pCp4YB29tRt9hNs9bR6x1kPo8w8dHbOMDePN8n8YmYTsx1oQrx1qQMrb8ZenDZ0pDZCnDpStCJWoV1",[{usr:"181090808",score:100,remark:"good"}]).then((res)=>console.log("ok"))
async function setScoreByWorkCode(work_code, updateTarget) {
    // updateTarget=[{usr,score,remark},{},...]
    let json = await getScoreByWorkCode(work_code)
    updateTarget.forEach(e => {
        json[e["usr"]] = {
            score: e["score"],
            remark: e["remark"] || ""
        }
    })
    json = JSON.stringify(json)
    await query("update score set json=? where work_code=?", [json, work_code])
}

exports.getScoreByWorkCode = getScoreByWorkCode
exports.setScoreByWorkCode = setScoreByWorkCode
exports.getScoreDetail = getScoreDetail


// getScoreByWorkCode("Uo9tRt9hNsvXRMKYEYBfd83ciOBbY8Rcdf0jvfoVvBYjvBsSvBYQ8YmYTsx1oQrx1YPMnlRcSYEY9uUdaYB29tRt9hNtHfRMKYEZ4sC3CuC38nEJOpCJDx1",
//     [{ usr: "181090808", score: 100,remark:"nice！！！" }, { usr: "181090809", score: 95 }])
//     .then(res => {
//         getScoreByWorkCode("Uo9tRt9hNsvXRMKYEYBfd83ciOBbY8Rcdf0jvfoVvBYjvBsSvBYQ8YmYTsx1oQrx1YPMnlRcSYEY9uUdaYB29tRt9hNtHfRMKYEZ4sC3CuC38nEJOpCJDx1").then(res => {
//             console.log(res)
//         })
//     })
// getScoreDetail("Uo9tRt9hNsvXRMKYEYBfd83ciOBbY8Rcdf0jvfoVvBYjvBsSvBYQ8YmYTsx1oQrx1YPMnlRcSYEY9uUdaYB29tRt9hNtHfRMKYEZ4sC3CuC38nEJOpCJDx1",
// "181090803").then(res => {
//     console.log(res)
// })

