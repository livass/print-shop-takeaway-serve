// 封装了更多文件操作
const fs = require('fs')
const util = require('util');  //用来提供常用函数的集合
const pdftk = require('node-pdftk')
const path = require('path')
const exec = util.promisify(require('child_process').exec);  // uti
const watermark = require('image-watermark');
const { createCanvas, loadImage } = require('canvas')
const pdf = require('html-pdf');
const base62x = require('base62x')


function rm_rf(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach((file) => {
            let curPath = path + "/" + file
            if (fs.statSync(curPath).isDirectory()) {
                rm_rf(curPath)
            } else {
                fs.unlinkSync(curPath)
            }
        })
        fs.rmdirSync(path)
        return true
    } else {
        return false
    }
}

function listFile(dir) {
    let list = []
    if (fs.existsSync(dir) == false) return list
    let arr = fs.readdirSync(dir);
    arr.forEach(async (item) => {
        let fullpath = path.join(dir, item);
        let stats = fs.statSync(fullpath);
        if (stats.isDirectory()) {
            list = list.concat(listFile(fullpath))
        } else {
            list.push(fullpath);
        }
    });
    return list;
}


async function wordToPdf(wordPath) {
    // 若已经为pdf则不需要转换
    if (path.extname(wordPath).toLocaleLowerCase() == ".pdf") return wordPath
    let ans = path.join(path.dirname(wordPath), path.basename(wordPath).replace(/\.docx?$/, ".pdf"))
    try {
        //console.log("开始转换")
        //console.log('libreoffice --headless --convert-to pdf --outdir ' + path.dirname(wordPath) + ' ' + wordPath)
        const { stdout, stderr } = await exec('libreoffice --headless --convert-to pdf --outdir ' + path.dirname(wordPath) + ' ' + wordPath);
        //console.log('stdout:', stdout);
        //console.log('stderr:', stderr);
    } catch (err) {
        console.log('------------------')
        console.log(err)
        console.log('------------')
    }
    return ans
}

async function pdfAddWatermark(url, watermark, newPdfUrl) {
    const tmpFileUrl = `./___mdWatermark${base62x.encode(newPdfUrl)}.pdf`
    //await htmlToPdf(watermark, tmpFileUrl)
    await textToPDF(watermark, tmpFileUrl)
    await new Promise((resolve, reject) => {
        pdftk.input(url)
            .background(tmpFileUrl)
            .output(newPdfUrl)
            .then((buffer) => {
                return resolve();
            }).catch(err => {
                console.log(err)
                return reject()
            })
    })
    fs.unlink(tmpFileUrl, () => { })
    return newPdfUrl
}

async function mdToPdf(mdString, url) {
    const tmpFileUrl = "./__tmp_fs_more_tmp.md"
    fs.writeFileSync(tmpFileUrl, mdString)
    try {
        const { stdout, stderr } = await exec("pandoc " + tmpFileUrl + " -o " + url + " --latex-engine=xelatex -V mainfont='SimSun'")
    } catch (err) { console.log(err) }
    fs.unlinkSync(tmpFileUrl)
    return url
}

// async function htmlToPdf(htmlString, url) {
//     const tmpFileUrl = "./__tmp_fs_more_tmp.html"
//     fs.writeFileSync(tmpFileUrl, htmlString)
//     try {
//         const { stdout, stderr } = await exec("pandoc " + tmpFileUrl + " -o " + url + " --latex-engine=xelatex -V mainfont='SimSun'")
//     } catch (err) { console.log(err) }
//     fs.unlinkSync(tmpFileUrl)
//     return url
// }

async function generatePdfCover(url, usr, name = "", work_class = "", work_no = "") {
    const html =
        `<div style="margin-top: 30%;padding: 5%;margin-left: 10%;margin-right: 10%;"><table style="font-size: 20px;" width="100%" border="0" align="center" cellpadding="0" cellspacing="0"><caption><h1>南京审计大学</h1></caption><tr><td>&nbsp</td></tr><tr><td>&nbsp</td></tr><tr align="center"><td>学 号：</td><td>${usr}</td></tr><tr><td>&nbsp</td></tr><tr align="center"><td>姓 名：</td><td>${name}</td></tr><tr><td>&nbsp</td></tr><tr align="center"><td>班 级：</td><td>${work_class}</td></tr><tr><td>&nbsp</td></tr><tr align="center"><td>作业序号：</td><td>${work_no}</td></tr></table></div>`
    //return await mdToPdf(md, url)
    return new Promise((resolve, reject) => {
        pdf.create(html, {}).toFile(url, function (err, res) {
            if (err) return reject(err);
            return resolve(url)
        });
    })


}
async function catPdf(target, A, B) {
    let order = `pdftk A=${A} B=${B} cat A B output ${target}`
    try {
        const { stdout, stderr } = await exec(order);
        //console.log('stdout:', stdout);
        //console.log('stderr:', stderr);
    } catch (err) {
        console.log(err)
    }
    return target
}
async function textToPDF(text, pdfUrl) {
    return new Promise((resolve, reject) => {
        let tmpFile = `${base62x.encode(pdfUrl)}.jpg`
        watermark.embedWatermarkWithCb(path.join(__dirname, "__water_tmp.jpg"), { dstPath: tmpFile, 'text': text, 'font': 'SimSun' }, (err) => {
            const canvas = createCanvas(500, 500, 'pdf')
            const ctx = canvas.getContext('2d')
            loadImage(path.join(tmpFile)).then((image) => {
                ctx.drawImage(image, 0, 0)
                var buff = canvas.toBuffer()
                fs.writeFileSync(pdfUrl, buff)
                fs.unlink(tmpFile, () => { })
                return resolve(pdfUrl)
            }).catch(err => reject(err))
        });
        //watermark.embedWatermark(path.join(__dirname, "__water_tmp.jpg"), { 'text': text, 'font': 'SimSun' });

    })
}

//generatePdfCover("syy.pdf","181090808","史洋炀","sj002","1")
//pdfAddWatermark("a.pdf")
//wordToPdf("../work/Uo9tRt9hNsvXRMKYEYBdhApak8dchA7alPpak9eYB29tRt9hNs9bR6x1kPo8w8dHbOMDePN8o8YmYTsx1oQrx1qQMrb8ZenDZ0oD38vD3SqC3OnV1/181090808/181090808_史洋炀_sj005_3.docx", "aa.pdf")
//wordToPdf("a.docx","aa.pdf")
exports.rm_rf = rm_rf
exports.wordToPdf = wordToPdf
exports.pdfAddWatermark = pdfAddWatermark
exports.mdToPdf = mdToPdf
// exports.htmlToPdf = htmlToPdf
exports.generatePdfCover = generatePdfCover
exports.catPdf = catPdf
exports.listFile = listFile
exports.textToPDF = textToPDF