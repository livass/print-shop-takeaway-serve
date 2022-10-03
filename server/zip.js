// 压缩打包文件
const zipper = require("zip-local")
const path = require('path')
const base62x = require('base62x')
const fs = require('fs')
const archiver = require('archiver')
const listFile = require('./fs_more').listFile
const sql = require('./sql')
const xlsx = require('node-xlsx');
const sstm = require('./scoreSystem')

async function zipByFolder(work_code, usr = "", expire = 10 * 60 * 1000) {
    // 建立文件夹下载
    let tmpFile = ""
    const work_detail = await sql.getWorkDetailsByWorkCode(work_code)
    tmpFile = [usr + "附件", work_detail["work_class"], work_detail["work_name"], work_detail["no"]].join("_")
    tmpFile += ".zip"
    let url = path.resolve(__dirname, '../public', 'tmp', tmpFile)
    // 生成成绩表
    let scoreAns = await sstm.getScoreByWorkCode(work_code)
    let xlsxObj = [{
        name: '成绩表',
        data: [["学号", "成绩"]],
    }]
    for (let e in scoreAns) {
        let sc = scoreAns[e]["score"] - 0;
        if (sc == -1) sc = "未打分"
        else if (sc < -1) sc = "未提交"
        xlsxObj[0].data.push([e, sc])
    }
    fs.writeFileSync(path.resolve(__dirname, '../work', work_code, ["成绩表", work_detail["work_class"], work_detail["work_name"], work_detail["no"]].join("_") + ".xlsx"), xlsx.build(xlsxObj), "binary");
    zipper.sync
        .zip(path.resolve(__dirname, '../work', work_code, usr))
        .compress()
        .save(url);
    return () => {
        relateUrl = url.replace(/^.+public/, "")
        // 定时删除文件
        // setTimeout(() => {
        //     fs.unlinkSync(url)
        // }, expire)
        return relateUrl
    }
}

async function zipAndDownload(work_code, expire = 10 * 60 * 1000) {
    // expire default=10min
    // 返回一个闭包，执行后返回下载链接，并启动定时删除功能
    let tmpFile = base62x.encode(JSON.stringify({
        time: new Date().getTime(),
    }))
    const work_detail = await sql.getWorkDetailsByWorkCode(work_code)
    tmpFile = [work_detail["work_class"], work_detail["work_name"], work_detail["no"]].join("_")
    tmpFile += ".zip"
    let url = path.resolve(__dirname, '../public', 'tmp', tmpFile)
    let list = listFile(path.resolve(__dirname, '../work', work_code))
    // 生成成绩表
    let scoreAns = await sstm.getScoreByWorkCode(work_code)
    let xlsxObj = [{
        name: '成绩表',
        data: [["学号", "成绩"]],
    }]
    for (let e in scoreAns) {
        let sc = scoreAns[e]["score"] - 0;
        if (sc == -1) sc = "未打分"
        else if (sc < -1) sc = "未提交"
        xlsxObj[0].data.push([e, sc])
    }
    fs.writeFileSync(path.resolve(__dirname, '../work', work_code, ["成绩表", work_detail["work_class"], work_detail["work_name"], work_detail["no"]].join("_") + ".xlsx"), xlsx.build(xlsxObj), "binary");
    // 只下载pdf
    list = list.filter((v) => {
        let vvv = path.extname(v).toLowerCase()
        return [".pdf", ".xlsx"].some(vv => vv == vvv)
    })
    await pkg(list, url)
    // zipper.sync
    //     .zip(path.resolve('work', work_code))
    //     .compress()
    //     .save(url)

    return () => {
        relateUrl = url.replace(/^.+public/, "")
        // 定时删除文件
        // setTimeout(() => {
        //     fs.unlinkSync(url)
        // }, expire)
        return relateUrl
    }
}

async function pkg(fileList, outputURL) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputURL)
        const archive = archiver('zip')
        archive.on('error', (err) => {
            throw err
        })
        archive.on('end', () => {
            return resolve()
        })
        archive.pipe(output)
        fileList.forEach((v) => {
            archive.file(v, { name: path.basename(v) })
        })
        archive.finalize()
    })
}


exports.zipAndDownload = zipAndDownload
exports.zipByFolder = zipByFolder
