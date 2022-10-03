const fs = require('fs')
/**
 * 
 * @param {string} url 缓存地址
 * @returns {JSON} set get reset
 */
function cache(url) {
    if (fs.existsSync(url) == false) {
        fs.writeFileSync(url, JSON.stringify({}))
    }
    let data = fs.readFileSync(url)
    try {
        data = JSON.parse(data)
    } catch (err) {
        console.log(err)
        return false
    }
    return {
        set: (d) => {
            for (let e in d) {
                data[e] = d[e]
            }
            fs.writeFileSync(url, JSON.stringify(data))
        },
        get: (d) => {
            if (typeof (d) == typeof ("")) return data[d]
            else return data
        },
        reset: () => {
            fs.writeFileSync(url, JSON.stringify({}))
        }
    }
}

exports.createCache = cache