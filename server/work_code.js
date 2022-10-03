// work_code 由 JSON格式的 work_name + work_belong + work_time 生成

const base62x = require('base62x')

function encode(work_name, work_belong, work_time = new Date().getTime()) {
    let work_code = { work_name, work_belong, work_time }
    work_code = JSON.stringify(work_code)
    work_code = base62x.encode(work_code)
    return work_code
}

function decode(work_code) {
    let res = base62x.decodeString(work_code)
    res = JSON.parse(res)
    return res
}

exports.encode=encode
exports.decode=decode