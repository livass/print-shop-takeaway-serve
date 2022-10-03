function Que() {
    let lock = false
    let que = []
    let clock = setInterval(() => {
        if (que.length == 0) return
        if (lock == true) return
        lock = true
        let [async_func, callback] = que.shift()
        async_func().then((res) => {
            lock = false
            callback(res)
        })
    }, 0)
    this.add = (async_func, callback = () => { }) => que.push([async_func, callback])
    this.done = () => que.length == 0
    this.left = () => que.length
    this.addSync = async (async_func) => {
        return await new Promise((resolve, reject) => {
            que.push([async_func, (res) => resolve(res)])
        })
    }
    this.clear = () => {
        clearInterval(clock)
        que = []
    }
}
exports.Que = Que

// async function test() {
//     let que = new Que()
//     que.add(async () => {
//         await new Promise((resolve, reject) => setTimeout(() => {
//             console.log("100ms执行")
//             resolve()
//         }, 100))
//     })
//     let res = await que.addSync(async () => {
//         return new Promise((resolve, reject) => {
//             setTimeout(() => resolve("100+1000ms执行"), 1000)
//         })
//     })
//     console.log(res)
// }
// test()