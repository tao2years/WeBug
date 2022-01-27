const fs = require('fs')
const path = require('path')
const del = require('del')
const tynt = require('tynt')

const copyDir = (sourcePath, targetPath) => {
    const flag1 = fs.existsSync(sourcePath)
    if (!flag1) {
        throw new Error("SourcePath Not Existing" + sourcePath);
        return;
    }
    mkdirsSync(targetPath)
    fs.readdirSync(sourcePath).forEach(item => {
        let midSourcePath = path.join(sourcePath, item)
        let midTargetPath = path.join(targetPath, item)
        if (fs.statSync(midSourcePath).isFile()) {
            fs.copyFileSync(midSourcePath, midTargetPath)
        } else {
            copyDir(midSourcePath, midTargetPath)
        }
    })
}

function mkdirsSync(dirname) {
    //console.log(dirname);
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

function rmFiles(sourcePath, targetPath) {
    var flag1 = fs.existsSync(targetPath)
    if (flag1){
        del.sync(targetPath)
        console.log("Del Old File in TargetPath Successfully: "+targetPath)
    }
    mkdirsSync(targetPath);
    copyDir(sourcePath, targetPath)
    del.sync(sourcePath)
}

function handleDotFile(filePath) {
    var content = fs.readFileSync(filePath, {encoding: 'utf-8'})
    var linesArr = content.split("\n")
    // for (line in linesArr){
    //     console.log(tynt.Red("Line: "+line+" "+linesArr[line]))
    // }
    // Filter
    var result_Arr = []
    for (line in linesArr){
        if(linesArr[line].length > 0 && !linesArr[line].includes("->") && linesArr[line].includes("label=\"\{")){
            var temp_arr = linesArr[line].split("label=\"\{")[1].split("\}\"")[0]
            if(temp_arr.includes("|")){
                var temp = temp_arr.split("|")
                for (no in temp) {
                    if(temp[no].includes("read") || temp[no].includes("write")){
                        if (temp[no].includes("write")){
                            console.log(tynt.Yellow(temp[no]))
                        }else{
                            console.log(tynt.Cyan(temp[no]))
                        }
                        result_Arr.push(temp[no])
                    }
                }
            }else{
                if(temp_arr.includes("read") || temp_arr.includes("write")){
                    if (temp_arr.includes("write")){
                        console.log(tynt.Yellow(temp_arr))
                    }else{
                        console.log(tynt.Cyan(temp_arr))
                    }
                    result_Arr.push(temp_arr)
                }
            }
        }
    }
}

exports.rmFiles = rmFiles
exports.mkdirsSync = mkdirsSync
