const esprima = require('esprima')
const estraverse = require('estraverse')
const fs = require('fs')
const tynt = require('tynt')
const path = require('path')
const dirwalk = require("@spatocode/dirwalk");
const util = require('./util')
const { execSync,exec } = require('child_process')
const ArgumentParser = require('argparse').ArgumentParser
const { replace } = require('estraverse')
const del = require('del')
const timeDiffStr = require('get-time-diff');
 

const parser = new ArgumentParser({
    add_help: true,
})
parser.add_argument('--pname', '-p', {help: "WeChat Mini Program Name which you want to detect"})

var logFlag = false
var wxSystemInfoVariableList = ['windowWidth', 'windowHeight', 'safeArea']
var AndroidOnlyList = ['wx.makeBluetoothPair', 'wx.qy.startNFCReader', 'wx.qy.stopNFCReader', 'canvas.toDataURL', 'wx.onShareTimeline']
var iOSOnlyList = ['BLEPeripheralServer.onCharacteristicSubscribed', 'VideoContext.showStatusBar', 'BackgroundAudioManager.onPrev', 
'BLEPeripheralServer.onCharacteristicUnsubscribed', 'wx.setBackgroundColor', 'wx.getSystemInfoSync']
var differenceList = ['wx.onCompassChange', 'wx.connectWifi', 'console.dir']
var systemInfoSyncRes = ['albumAuthorized', 'notificationAlertAuthorized', 'notificationSoundAuthorized', 'notificationBadgeAuthorized']
var filterList = []

// get Line-funtionName through analyzing AST
function getFunctionByFilePath(filePath) {
    var code =  fs.readFileSync(filePath, {encoding: 'utf-8'})
    var flag = false
    try {
        var ast = esprima.parse(code, {loc:true})
        flag = true

    } catch (error) {
        console.log(tynt.Red("Error in Translating AST in File: ["+filePath+"] "))
        return false
    }
    if (flag){
        var ast = esprima.parse(code, {loc:true})
        var resultList = []
        var wxFunctionList = []
        var dataFunctionList = []
        var requireList = []
        var returnList = []
        var compatibilityList = []
        var ifList = []
        var currentRet
        estraverse.traverse (ast, {
            enter: function (node) {
                // Get Function Call
                if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression') {
                    if (node.expression.callee.type === 'Identifier') {
                        var args = node.expression.arguments
                        var parg = 'undefined'
                        if (args.length > 0) {
                            if (args.length == 1){
                                parg = args[0].name
                            }else{
                                parg = ''
                                for (no=0; no<args.length-1; no++){
                                    parg += args[no].name + '.'
                                }
                                parg += args[args.length-1].name
                            }
                        }
                        var value = {"line": node.loc.start.line, "fname": node.expression.callee.name, "args": parg, 'end': node.loc.end.line}
                        resultList.push(value)
                        if (logFlag) console.log(tynt.White(node.loc.start.line+ " "+node.expression.callee.name+" "+parg))
                    }else if (node.expression.callee.type === 'MemberExpression'){
                        var result = node.expression.callee.object.name + "." + node.expression.callee.property.name
                        var args = node.expression.arguments
                        for (arg in args){
                            if (args[arg].type === 'FunctionExpression'){
                                var params = args[arg].params
                                var parg = 'undefined'
                                if (params.length > 0 ){
                                    currentRet = params[0].name
                                    parg = currentRet
                                }
                                var value = {"line": node.loc.start.line,"fname": result, "args": parg, 'end': node.loc.end.line}
                                resultList.push(value)
                                if (logFlag) console.log(tynt.White(node.loc.start.line+" "+ result+ " "+parg))
                            }
                        }
                    }
                }
                // Get All funtionScope like F_name: function F(..){}
                if (node.type === 'Property' && node.value.type === 'FunctionExpression'){
                    if (node.key.name === 'success' || node.key.name === 'fail' || node.key.name === 'complete'){
                        var res_paras = node.value.params
                        var parg = 'undefined'
                        if (res_paras.length > 0) {
                            currentRet = res_paras[0].name
                            parg = res_paras[0].name
                        }
                        var value = {"line": node.loc.start.line, "fname": node.key.name, "args": parg, 'end': node.loc.end.line}
                        resultList.push(value)
                        if (logFlag) console.log(tynt.Green(node.loc.start.line + " "+node.key.name+" " +parg))
                    }else{
                        var res_paras = node.value.params
                        var parg = 'undefined'
                        if (res_paras.length > 0) {
                            currentRet = res_paras[0].name
                            parg = res_paras[0].name
                        }
                        var value = {"line": node.loc.start.line, "fname": node.key.name, "args": parg, 'end': node.loc.end.line}
                        resultList.push(value)
                        if (logFlag) console.log(tynt.Blue(node.loc.start.line + " "+node.key.name+" " + parg))
                    }
                }
                // Get All functionDeclaration like:
                //  function F_name(..)
                if (node.type === 'FunctionDeclaration'){
                    var res_paras = node.params
                    var parg = 'undefined'
                    if (res_paras.length > 0) {
                        currentRet = res_paras[0].name
                        parg = res_paras[0].name
                    }
                    var value = {"line": node.loc.start.line, "fname": node.id.name, "args": parg, 'end': node.loc.end.line}
                    resultList.push(value)
                    if (logFlag) console.log(tynt.Blue(node.loc.start.line +" "+node.id.name+" "+parg))
                }
                // Get All functionDeclaration like:
                // var F_name = function name(..)
                if (node.type === 'VariableDeclarator' && node.init && node.init.type === 'FunctionExpression') {
                    var res_paras = node.init.params
                    var parg = 'undefined'
                    if (res_paras.length > 0) {
                        currentRet = res_paras[0].name
                        parg = res_paras[0].name
                    }
                    var value = {"line": node.loc.start.line, "fname": node.id.name, "args": parg, 'end': node.loc.end.line}
                    resultList.push(value)
                    if (logFlag) console.log(tynt.Blue(node.loc.start.line +" "+node.id.name+" "+parg))
                }
                // Get All functionDeclaration like:
                // Object.__proto__.func = function x()
                if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression' && node.expression.right.type === 'FunctionExpression' && node.expression.left.object&& node.expression.left.object.object) {
                    var var_name = node.expression.left.object.object.name + '.' + node.expression.left.object.property.name +
                    '.' + node.expression.left.property.name
                    var res_paras = node.expression.right.params
                    var parg = 'undefined'
                    if (res_paras.length > 0) {
                        currentRet = res_paras[0].name
                        parg = res_paras[0].name
                    }
                    var value = {"line": node.loc.start.line, "fname": var_name, "args": parg, 'end': node.loc.end.line}
                    resultList.push(value)
                    if (logFlag) console.log(tynt.Blue(node.loc.start.line+" "+var_name+" "+parg))
                }
                // wx.Function Record
                if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
                    if (node.callee.object.name === 'wx') {
                        var value = {"line": node.loc.start.line, "fname": node.callee.object.name + "." + node.callee.property.name, 
                        "end": node.loc.end.line}
                        wxFunctionList.push(value)
                        if (logFlag) console.log(tynt.Red(node.loc.start.line + " "+node.callee.object.name + "." + node.callee.property.name + " " + node.loc.end.line))
                    }
                }
                // Get All Callback Data.properties
                if (node.type === 'MemberExpression' && currentRet === node.object.name && node.object.name!=undefined) {
                    var value = {"line": node.loc.start.line, "Data": node.object.name+"."+node.property.name, "end": node.loc.end.line}
                    dataFunctionList.push(value)
                    // console.log(tynt.Yellow(node.object.name+"."+node.property.name + " Line: " + node.loc.start.line + "-" + node.loc.end.line))
                }
                // Get All Callback constant 逻辑表达式返回值且为Literal
                if (node.type === 'ReturnStatement' && node.argument!=null && node.argument.type === 'LogicalExpression') {
                    if (node.argument.right.type === 'CallExpression' && node.argument.right.arguments!=null && node.argument.right.arguments[0]
                    && node.argument.right.arguments[0].value!=undefined){
                        var value = {"line": node.loc.start.line, "Data": node.argument.right.arguments[0].value, "end": node.loc.end.line}
                        dataFunctionList.push(value)
                        // console.log(tynt.Yellow(node.argument.right.arguments[0].value+ " Line: " + node.loc.start.line + "-" + node.loc.end.line))
                    }
                }
                // Get Require
                if (node.type === 'VariableDeclaration' && node.declarations[0]['init'] &&node.declarations[0]['init'].type === 'CallExpression') {
                    if (node.declarations[0]['init'].callee.name === 'require'){
                        var value = {"line": node.loc.start.line, "name": node.declarations[0]['id'].name, "arg": node.declarations[0]['init'].arguments[0].value}
                        requireList.push(value)
                        // console.log(tynt.Cyan(node.declarations[0]['id'].name+" <- "+"require() " + node.declarations[0]['init'].arguments[0].value+ " Line: " + node.loc.start.line + "-" + node.loc.end.line))
                    }
                }
                // Get Return State Loc
                if (node.type === 'ReturnStatement') {
                    var value = {"line": node.loc.start.line, "end": node.loc.end.line}
                    returnList.push(value)
                }
                // Compatibility Function Record
                if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
                    var _funcName = node.callee.object.name + "." + node.callee.property.name
                    if (differenceList.includes(_funcName)||iOSOnlyList.includes(_funcName)||AndroidOnlyList.includes(_funcName)){
                        var value = {"line": node.loc.start.line,"name": _funcName}
                        compatibilityList.push(value)
                    }
                }
                // Get If Condition to help identify
                if (node.type === 'IfStatement') {
                    var value = {"line": node.loc.start.line, "end": node.loc.end.line}
                    ifList.push(value)
                }
            },
            leave: function (node) {
                if (node.type === 'Property' && node.value.type === 'FunctionExpression'){
                    if (node.key.name === 'success' || node.key.name === 'fail' || node.key.name === 'complete'){ 
                        currentRet = null;
                    }
                }
            }
        })
            return {resultList, wxFunctionList, dataFunctionList, requireList, returnList, compatibilityList, ifList}
    }
    
}

function DataflowAnalysisByFilePath(filePath) {
    var cmd = 'java -jar '+path.join('dist','tajs-all.jar') +' '+filePath + ' -flowgraph'
    var flag = true
    try {
        execSync(cmd)
    } catch (error) {
        console.log(tynt.Red("Ecec_TAJS_Cmd Failure in File ["+ filePath+" ]"))
        flag = false
    }
    if (flag){
        console.log(tynt.Green("Successfully Ecec_TAJS_Cmd in File ["+ filePath+" ]"))
        var targetFilePath = path.join('result', filePath)
        var sourceFilePath = path.join('out', 'flowgraphs')
        util.rmFiles(sourceFilePath, targetFilePath)
    }
    return flag 
}


// Get Function_Name by Loc_line
function getFunctionNameByLoc(line, arrList) {
    var target = -1
    for (key in arrList){
        if (line === arrList[key].line){
            target = key
        }
    }
    if (target != -1){
        return arrList[key]
    }else{
        return null
    }
}

function printList(list) {
    for (key in list){
        console.log("'"+list[key]+"',")
    }
}

// Get All JavaScript Files from a project path
function getJSFilesFromProjectPath(projectPath) {
    var files = dirwalk.walkSync(projectPath)
    // var files = dirwalk.walkSync(path.join("benchmarks", projectName))
    var js_Files = []
    for (no in files){
        var fileName = files[no]
        if (path.extname(fileName) === '.js' && !fileName.includes(".min")){
            js_Files.push(fileName)
        }
    }
    return js_Files
}

// Use babel to transfer the project to es5
// Some higher features are not supported by TAJS
// Target Project Path runtime/projectName
function transfer2ES5 (projectName, _flag=false) {
    if (_flag) {
        var cmd = 'babel ' + path.join('known_bugs', projectName) + ' --out-dir ' + path.join('runtime', projectName)
    } else{
        var cmd = 'babel ' + path.join('benchmarks', projectName) + ' --out-dir ' + path.join('runtime', projectName)
    }
    
    var flag = true
    try {
        execSync(cmd)
    } catch (error) {
        console.log(tynt.Red("Exec_Transfer2ES5_Cmd Fail during project "+ projectName))
        flag = false
    }
    return flag
}

function functionRecordAndDFA (js_Files, projectPath) {
    var failToHandleFileList = []
    var failASTList = []
    var allresult = []
    for (key in js_Files){
        console.log(tynt.Red("Handling Files: "+js_Files[key]))
        var filePath = js_Files[key]
        var result = getFunctionByFilePath(filePath, {encoding: 'utf-8'})
        if (result != false){
            // Transfer AST Successfully
            var comFuncList = result['resultList']
            var wxFunctionList = result['wxFunctionList']
            var dataList = result['dataFunctionList']
            var requireList = result['requireList']
            var returnList = result['returnList']
            var compatibilityList = result['compatibilityList']
            var ifList = result['ifList']
            var flag = DataflowAnalysisByFilePath(filePath)
            if (!flag){  // Data Flow Analysis Successful
                // Add Failure Info
                var value = {"Fname":path.basename(filePath), "Loc":filePath}
                failToHandleFileList.push(value)
            }
            var value = {"Fname": filePath,  "requireList": requireList, "comList": comFuncList, 
            "wxList": wxFunctionList, "dataList": dataList, 'returnList': returnList, 'compatibilityList': compatibilityList, 
            'ifList': ifList}
            allresult.push(value)
            // var targetFilePath_4_Function = path.join('result', filePath,'comList.json')
            // util.mkdirsSync(path.dirname(targetFilePath_4_Function))
            // fs.writeFileSync(targetFilePath_4_Function, JSON.stringify(comFuncList))
            // var targetFilePath_4_WxFunction = path.join('result', filePath,'wxList.json')
            // util.mkdirsSync(path.dirname(targetFilePath_4_WxFunction))
            // fs.writeFileSync(targetFilePath_4_WxFunction, JSON.stringify(wxFunctionList))
            // var targetFilePath_4_DataFunction = path.join('result', filePath,'dataList.json')
            // util.mkdirsSync(path.dirname(targetFilePath_4_DataFunction))
            // fs.writeFileSync(targetFilePath_4_WxFunction, JSON.stringify(dataList))
        }else{
            var value = {"Fname":path.basename(filePath), "Loc":filePath}
            failASTList.push(value)
        }
    }
    // Save Fail Files Information
    if (failToHandleFileList.length > 0){
        var failFilePath = path.join('result', projectPath, 'Fail_TAJS_file.json')
        if (fs.existsSync(failFilePath)){
            del.sync(failFilePath)
        }
        if(logFlag) console.log(failFilePath)
        fs.writeFileSync(failFilePath, JSON.stringify(failToHandleFileList))
    }
    if (failASTList.length > 0){
        var failFilePath = path.join('result', projectPath, 'Fail_Esprima_file.json')
        if(logFlag) console.log(failFilePath)
        if (fs.existsSync(failFilePath)){
            del.sync(failFilePath)
        }
        fs.writeFileSync(failFilePath, JSON.stringify(failASTList))
    }
    if (allresult.length > 0){
        var failFilePath = path.join('result', projectPath, 'result.json')
        if(logFlag) console.log(failFilePath)
        if (fs.existsSync(failFilePath)){
            del.sync(failFilePath)
        }
        fs.writeFileSync(failFilePath, JSON.stringify(allresult))
    }
    // printList(failToHandleFileList)
    // printList(failASTList)
}

// Detect the variable usage under the wx.getSystemInfo
function searchVariableUnderSystemInfo(start, end, dataList) {
    var usageList = []
    var safeFlag = false
    for (number in dataList){
        var item = dataList[number]
        if (item.line >= start && item.end <= end){
            var data = item.Data
            for (variable in wxSystemInfoVariableList) {
                if (data.includes(wxSystemInfoVariableList[variable])){
                    var value = {"line": start, "variable": data, "usage": wxSystemInfoVariableList[variable]}
                    usageList.push(value)
                    if (data == wxSystemInfoVariableList[2]) safeFlag = true
                }
            }
        }
    }
    usageList.push(value)
    return {usageList, safeFlag}
}

function detectWxSystemInfoUsage(projectPath) {
    var resultPath = path.join('result', projectPath, 'result.json')
    var content = fs.readFileSync(resultPath, 'utf-8')
    var file = JSON.parse(content)
    var resultList = []
    var safeFlag = false
    for (number in file){
        // if (number<1){
        var fileName = file[number].Fname
        var comList = file[number].comList
        var wxList = file[number].wxList
        var dataList = file[number].dataList
        if (wxList.length>0){
            for (line in wxList){
                if (wxList[line].fname === 'wx.getSystemInfo'){
                    var start = wxList[line].line
                    var end = wxList[line].end
                    var res = searchVariableUnderSystemInfo(start, end, dataList)
                    var result = res['usageList']
                    safeFlag = res['safeFlag']
                    if (result.length > 0) {
                        var value = {"Fname": fileName, "wx.getSystemInfo": result}
                    }else{
                        var value = {"Fname": fileName, "wx.getSystemInfo": "None"}
                    }
                    resultList.push(value)
                }
            }
        }
        // }
    }
    if (resultList.length > 0) {
        printList(resultList)
        if (!safeFlag){
            console.log(tynt.Green("[1] Project [" + path.basename(projectPath) +"] use wx.getSystemInfo") +tynt.Red(" But not use safeArea")  )
            var analysisFile = path.join('result', projectPath, 'analysis_system_info.json')
            if (fs.existsSync(analysisFile)){
                del.sync(analysisFile)
            }
            fs.writeFileSync(analysisFile, JSON.stringify(resultList))
            return 1
        }else{
            console.log(tynt.Green("[1] Project [" + path.basename(projectPath) +"] use wx.getSystemInfo")  )
            var analysisFile = path.join('result', projectPath, 'analysis_system_info.json')
            if (fs.existsSync(analysisFile)){
                del.sync(analysisFile)
            }
            fs.writeFileSync(analysisFile, JSON.stringify(resultList))
            return 2
        }
    }else{
        console.log(tynt.Red("[1] Project [" + path.basename(projectPath) +"] does not use wx.getSystemInfo"))
        var analysisFile = path.join('result', projectPath, 'analysis_system_info.json')
        var value = {"wx.getSystemInfo": false}
        if (fs.existsSync(analysisFile)){
            del.sync(analysisFile)
        }
        fs.writeFileSync(analysisFile, JSON.stringify(value))
        return -1
    }
}


// detectWxRequest 
function detectWxRequest(projectPath) {
    // Detect wx.request usage and & data inconsistent
    var resultFilePath = path.join('result', projectPath, 'result.json')
    var file = JSON.parse(fs.readFileSync(resultFilePath,{encoding:'utf-8'}))
    var _dataList =[]
    // ADD 测试第一个文件的解析
    for (_cell in file){
        var fileCell = file[_cell]
        var fileName = fileCell.Fname
        var requireList = fileCell.requireList
        var legalRequireList = []
        if (requireList.length > 0 ){
            // Multiple requires
            for (item in requireList){
                var requireFilePath = path.join(path.dirname(fileName), requireList[item].arg)
                // Require File Exists
                if (fs.existsSync(requireFilePath)) {
                    var value = {"name": requireList[item].name, "file": requireFilePath}
                    legalRequireList.push(value)
                }
            }
        }
        var comList = fileCell.comList
        // detect require libraries usage
        var completeRequireList = []
        if (legalRequireList.length > 0){
            // printList(legalRequireList)
            for (temp in comList){
                var temp = comList[temp]
                var temp_name = temp.fname
                for (line in legalRequireList){
                    var li = legalRequireList[line]
                    if (temp_name && temp_name.split(".")[0] == li.name){
                        var value = {"name": temp_name, "from": fileName,"arg": temp.args ,"line": temp.line, "end": temp.end, "path": li.file, "func": temp_name.split(".")[1]}
                        completeRequireList.push(value)
                    }
                }
            }
        }
        if (completeRequireList.length > 0){
            // printList(completeRequireList)
            // Get Each Return Value for the required function
            for (temp in completeRequireList){
                var l_c = completeRequireList[temp]
                var filepath = l_c.path
                var fileContent = searchRecordByPath(filepath, file)
                var fileFunc = l_c.func
                if (fileContent){
                    var result = searchReturnValue(fileFunc, fileContent)
                    var successValue = result.success
                    var failValue = result.fail
                    completeRequireList[temp].success = successValue
                    completeRequireList[temp].fail = failValue
                }
            }
            // Start to detect Data usage 
            // printList(completeRequireList)
            var dataTransList =[]
            for (temp in completeRequireList){
                var l_c = completeRequireList[temp]
                
                var DFA_dirPath = path.join('result', l_c.from)
                if (fs.existsSync(DFA_dirPath)){
                    var DFA_files = dirwalk.walkSync(DFA_dirPath)
                    for (files in DFA_files){
                        var fullPath = DFA_files[files]
                        var _fileName = path.basename(fullPath)
                        var specific_tag = "line"+l_c.line
                        if (_fileName.includes("final-") && _fileName.includes(specific_tag)){
                            // Handle data flow analysis result
                            var result = handleDotFile(fullPath, temp.args)
                            var value = {"Fname": fileName,"name": l_c.name, "line": l_c.line, "end": l_c.end, "data": result, "success": l_c.success, "fail": l_c.fail}
                            dataTransList.push(value)
                        }
                    }
                }
            }
            // Detect transfer usage
            if (dataTransList.length>0){
                // printList(dataTransList)
                for (_line in dataTransList){
                    var _cell = dataTransList[_line]
                    var _resultFile = searchRecordByPath(_cell.Fname, file)
                    var _comList = _resultFile.comList
                    for (_temp_com in _comList){
                        var _com = _comList[_temp_com]
                        if (_cell.line <= _com.line && _cell.end >= _com.end){
                            var _name = _com.fname
                            if (_cell.data[0] && _name.includes(".") && _name.includes(_cell.data[0].to)){
                                if (typeof(_cell.success) == 'boolean' || typeof(_cell.success) == 'undefined' || typeof(_cell.fail) =='boolean' || typeof(_cell.fail)=='undefined'){
                                    // Filter 'If' caused False-Positive
                                    for (_tc in _comList) {
                                        var __tc = _comList[_tc]
                                        if (__tc.fname == _cell.name && __tc.line <= _cell.line && __tc.end >= _com.line){
                                            var _Content = searchRecordByPath(_cell.Fname, file)
                                            var ifContent = _Content.ifList
                                            var dataContent = _Content.dataList
                                            // console.log(tynt.Cyan(JSON.stringify(dataContent)))
                                            var _flag = true
                                            for (_if in ifContent){
                                                // console.log(ifContent[_if].line, dataContent, __tc.args)
                                                // var result =searchIfVariable(ifContent[_if].line, dataContent, __tc.args)
                                                if (ifContent[_if].line >= _cell.line && ifContent[_if].end >=_com.line && ifContent[_if].line <= _com.line && searchIfVariable(ifContent[_if].line, dataContent, __tc.args)){
                                                    _flag = false
                                                }
                                            }
                                            if (_flag){
                                                var value = {"Fname":_cell.Fname, "func": _cell.name,"arg":__tc.args ,"line":_cell.line ,"success":_cell.success, "fail":_cell.fail, 
                                                    "from": _cell.data[0].from, "to": _cell.data[0].to, "data": _name, "data_line": _com.line,"result": "Error"}
                                                _dataList.push(value)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Asynchronous APIs do not set success and fail callback, directly using the callback data and fetch the property
        var wxList = fileCell.wxList
        var comList = fileCell.comList
        var dataList = fileCell.dataList
        for (_line in wxList){
            var _cell = wxList[_line]   
            if (!_cell.fname.includes("Sync") && filterList.includes(_cell.fname) && fileCell.Fname.includes("runtime") ){
                var _flag = true
                for (_com in comList){
                    var _comCell = comList[_com]
                    if (_comCell.fname == 'success' || _comCell.fname == 'fail'){
                        
                        if (_comCell.line >= _cell.line && _comCell.end <= _cell.end){
                            // The wx API has set the success & fail 
                            _flag = false
                        }
                    }
                }
                if (_flag){
                    // Handle problems
                    var value = {"Fname": fileCell.Fname, "func": _cell.fname, "line": _cell.line}
                    _dataList.push(value)
                }
            }
        }
    }
    
    var analysisFile = path.join('result', projectPath, 'analysis_wx_request.json')
    if (fs.existsSync(analysisFile)){
        del.sync(analysisFile)
    }
    fs.writeFileSync(analysisFile, JSON.stringify(_dataList))
    if(_dataList.length > 0){
        // printList(_dataList)
        console.log(tynt.Red("[2] Found Data misuse problems in project "+path.basename(projectPath)))
        var flag = true
        return {flag, _dataList}
    }else{
        console.log(tynt.Green("[2] Not found Data misuse problems in project "+path.basename(projectPath)))
        var flag = false
        var temp = false
        return {flag, temp}
    }
}

function searchIfVariable(ifLine, dataContent, args){
    var _flag = false
    for (_data in dataContent){
        if (dataContent[_data].line == ifLine && dataContent[_data].Data.includes(args)){
            _flag = true
        }
    }
    return _flag
}

function searchDataAccess(l_c, fileCell) {
    var arg = l_c.arg
    var success = l_c.success
    var fail = l_c.fail
    var dataList = fileCell.dataList
    for (temp in dataList){
        var name = dataList[temp].Data.split(".")[0]
        if (name == arg && l_c.line <= dataList[temp].line && l_c.end >= dataList[temp].end){
            console.log("Access: "+dataList[temp].Data + "Line: "+dataList[temp].line)
        }
    }

}

function handleDotFile(dotFilePath, args) {
    // console.log(tynt.Red("[Start]---------- File "+dotFilePath +" ----------"))
    var content = fs.readFileSync(dotFilePath, {encoding: 'utf-8'})
    var linesArr = content.split("\n")
    var result_Arr = []
    for (line in linesArr){
        if(linesArr[line].length > 0 && !linesArr[line].includes("->") && linesArr[line].includes("label=\"\{")){
            var temp_arr = linesArr[line].split("label=\"\{")[1].split("\}\"")[0]
            if(temp_arr.includes("|")){
                var temp = temp_arr.split("|")
                for (no in temp) {
                    if(temp[no].includes("read") || temp[no].includes("write")){
                        result_Arr.push(temp[no])
                    }
                }
            }else{
                if(temp_arr.includes("read") || temp_arr.includes("write")){
                    result_Arr.push(temp_arr)
                }
            }
        }
    }
    // printList(result_Arr)
    var temp_List = []
    for (line in result_Arr){
        var line_content = result_Arr[line]
        var line_No = line_content.split(":")[0].replace(" ","")
        // read-variable, read-property, write-variable, writeproperty
        var line_type = line_content.split(":")[1].split("[")[0].replace(" ","")
        var line_tri = line_content.split(":")[1].split("[")[1].split("]")[0].replace(" ","")
        var tri_content = line_tri.split(",")
        var tri_1 = tri_content[0].replace("'","").replace("'","")
        var tri_2 = tri_content[1].replace("'","").replace("'","")
        if (tri_content.length>2){
            var tri_3 = tri_content[2].replace("'","").replace("'","")
        }else{
            var tri_3 = 'undefined'
        }
        // console.log(line_No, line_type, tri_1, tri_2, tri_3)
        var value = {"line":line_No, "type":line_type, "t1": tri_1,"t2": tri_2, "t3": tri_3}
        temp_List.push(value)
    }
    var wvList = []
    var rv =[]
    var rp = []
    var dataTransList = []
    for (line in temp_List){
        var cell = temp_List[line]
        if (cell.type == 'write-variable'){
            // console.log(tynt.Green(JSON.stringify(cell)))
            var value = {"name": cell.t2, "no": cell.t1, "line":cell.line}
            wvList.push(value)
        }else if (cell.type == 'read-variable'){
            var value = {"name": cell.t1, "no": cell.t2, "line":cell.line}
            rv.push(value)
        }else if (cell.type == 'read-property'){
            var value = {"name": cell.t2, "pre":cell.t1, "suf":cell.t3, "line":cell.line}
            rp.push(value)
        }
    }
    for (wv_temp in wvList){
        var wv_cell = wvList[wv_temp]
        for (rp_temp in rp){
            if (rp[rp_temp].line < wv_cell.line && rp[rp_temp].suf == wv_cell.no){
                for (rv_temp in rv){
                    if(rv[rv_temp].line < rp[rp_temp].line && rp[rp_temp].pre == rv[rv_temp].no){
                        var value = {"from": rv[rv_temp].name+"."+rp[rp_temp].name, "to":wv_cell.name }
                        dataTransList.push(value)
                    }
                }
            }
        }
    }
    // console.log(tynt.Red("[End]---------- File "+dotFilePath +" ----------"))
    return dataTransList
}


// Find Record by filePath
function searchRecordByPath(filePath, resultfile) {
    for (temp in resultfile){
        if (resultfile[temp].Fname == filePath){
            return resultfile[temp]
        }
    }
}

// Get Function return values
function searchReturnValue(fileFunc, fileContent) {
    var success = undefined
    var fail = undefined
    // console.log(tynt.Red(fileContent))
    var comList = fileContent.comList
    var wxList = fileContent.wxList
    var dataList = fileContent.dataList
    var returnList = fileContent.returnList
    for (line in comList) {
        if (comList[line].fname == fileFunc){
            for (line_wx in wxList){
                if (wxList[line_wx].fname == 'wx.request' && comList[line].line <= wxList[line_wx].line && 
                    comList[line].end >= wxList[line_wx].end){
                    for (line_data in dataList){
                        if (wxList[line_wx].line <= dataList[line_data].line && wxList[line_wx].end >= dataList[line_data].end){
                            // console.log(tynt.Red(dataList[line_data].line + " "+dataList[line_data].Data))
                            for (line_return in returnList){
                                if (dataList[line_data].line <= returnList[line_return].line && dataList[line_data].end>= returnList[line_return].end){
                                    for (line_com in comList){
                                        if (comList[line_com].line <= returnList[line_return].line && comList[line_com].end>=returnList[line_return].end){
                                            if (comList[line_com].fname == 'success'){
                                                success = dataList[line_data].Data
                                            }else if (comList[line_com].fname == 'fail'){
                                                fail = dataList[line_data].Data
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return {success, fail}
}

// Detect compatibility API Usage
function detectCompatibilityUsage(projectPath) {
    var resultFilePath = path.join('result', projectPath, 'result.json')
    var file = JSON.parse(fs.readFileSync(resultFilePath,{encoding:'utf-8'}))
    var compatibilityResult = []
    for (_cell in file){
        var fileCell = file[_cell]
        var fileName = fileCell.Fname
        var compatibilityList = fileCell.compatibilityList
        if (compatibilityList.length>0){
            // ADD Specific Condition of wx.getSystemInfoSync
            for (_temp in compatibilityList){
                if (compatibilityList[_temp].name == 'wx.getSystemInfoSync'){
                    var _targetFileContent = searchRecordByPath(fileName, file)
                    var _dataList = _targetFileContent.dataList
                    if (_dataList.length > 0){
                        for (_data in _dataList){
                            if(_dataList[_data.Data] && systemInfoSyncRes.includes(_dataList[_data.Data].split(".")[1])){
                                var value = {"FName": fileName, "CompatibilityList":compatibilityList}
                                compatibilityResult.push(value)
                            }
                        }
                    }
                }else{
                    var value = {"FName": fileName, "CompatibilityList":compatibilityList}
                    compatibilityResult.push(value)
                }
            }
        }
    }
    if (compatibilityResult.length>0){
        console.log(tynt.Red("[3] Project Uses Compatibility APIs"))
        var analysisFile = path.join('result', projectPath, 'analysis_compatibility.json')
        if (fs.existsSync(analysisFile)){
            del.sync(analysisFile)
        }
        fs.writeFileSync(analysisFile, JSON.stringify(compatibilityResult))
        return compatibilityResult
    }else{
        console.log(tynt.Green("[3] Project does not use Compatibility APIs"))
        return false
    }
}


function detectKnownBugs() {
    var projectList = ['ColorUI_bug', 'wxParse_bug', 'pinche_xcx_bug', 'weapp-github-trending_bug']

    var startTime = new Date().getTime();

    var resultList = []
    var resultList_Details = []
    for (p in projectList){
        var projectName = projectList[p]
        var projectPath = path.join('benchmarks', projectName)
        var flag2 = fs.existsSync(projectPath)
        if (!flag2) {
            throw new Error("Detect Programs does not exist in " + projectPath)
        }else{
            console.log(tynt.Green("-------- Start detection ["+projectName+"] --------"))
            var toES5 = transfer2ES5(projectName)
            // var toES5 = true // ADD  Need to be removed
            if (toES5) {
                var targetPath = path.join('runtime', projectName)
                console.log(tynt.Green("Project "+ projectName+" has been transfered into ES5"))
            }else{
                var targetPath = path.join('benchmarks', projectName)
                console.log(tynt.Green("Project "+ projectName+" fails to transfer into ES5"))
            }
            var js_Files = getJSFilesFromProjectPath(targetPath)
            printList(js_Files)
            if (js_Files.length > 0 ){
                functionRecordAndDFA(js_Files, targetPath)
                console.log(tynt.Green("--- Start Analysis ["+projectName+"] ---"))
                console.log(tynt.Green("\r\r Target path: "+targetPath+" "))
                var flag_1 = detectWxSystemInfoUsage(targetPath)
                var flag_2 = detectWxRequest(targetPath)
                var flag_3 = detectCompatibilityUsage(targetPath)
                if (flag_2['flag']){
                    var value_all = {"ProjectName": projectName, "adapt_System":flag_1, "dataMisuse":flag_2['_dataList'], 'compatibility':JSON.stringify(flag_3)}
                    resultList_Details.push(value_all)
                    var value = {"ProjectName": projectName, "adapt_System":flag_1, "dataMisuse":flag_2['flag'], 'compatibility':JSON.stringify(flag_3)}
                    resultList.push(value)
                }else{
                    var value = {"ProjectName": projectName, "adapt_System":flag_1, "dataMisuse":flag_2['flag'], 'compatibility':JSON.stringify(flag_3)}
                    resultList.push(value)
                }
            }
        }
    }

    var analysisFile = path.join('Result_Known.json')
    if (fs.existsSync(analysisFile)){
        del.sync(analysisFile)
    }
    fs.writeFileSync('Result_Known.json', JSON.stringify(resultList))


    var endTime = new Date().getTime();
    
    var ans = timeDiffStr({
    startDate: startTime,
    endDate: endTime,
    options: {
        extraConfig: {
        lang: 'en',
        upper: 'first'
        }
    },
    });
    
    console.log(tynt.Red("Cost time: "+ans));
}

function detectUnknownBugs() {
    var files = fs.readdirSync(path.join('benchmarks'))
    // var known_projectList = ['ColorUI_bug', 'wxParse_bug', 'pinche_xcx_bug', 'weapp-github-trending_bug']
    var projectList = []
    // var projectList = ['weapp-ssha-master']
    for (i in files){
        if (path.extname(files[i])!='.zip' && !known_projectList.includes(path.basename(files[i]))){
            projectList.push(files[i])
        }
    }
    

    // printList(projectList)

    var startTime = new Date().getTime();

    var resultList = []
    var resultList_Details = []
    for (p in projectList){
        var projectName = projectList[p]
        var projectPath = path.join('benchmarks', projectName)
        var flag2 = fs.existsSync(projectPath)
        if (!flag2) {
            throw new Error("Detect Programs does not exist in " + projectPath)
        }else{
            console.log(tynt.Green("-------- Start detection ["+projectName+"] --------"))
            var toES5 = transfer2ES5(projectName)
            // var toES5 = true // ADD  Need to be removed
            if (toES5) {
                var targetPath = path.join('runtime', projectName)
                console.log(tynt.Green("Project "+ projectName+" has been transfered into ES5"))
            }else{
                var targetPath = path.join('benchmarks', projectName)
                console.log(tynt.Green("Project "+ projectName+" fails to transfer into ES5"))
            }
            var js_Files = getJSFilesFromProjectPath(targetPath)
            printList(js_Files)
            if (js_Files.length > 0 ){
                functionRecordAndDFA(js_Files, targetPath)
                console.log(tynt.Green("--- Start Analysis ["+projectName+"] ---"))
                console.log(tynt.Green("\r\r Target path: "+targetPath+" "))
                var flag_1 = detectWxSystemInfoUsage(targetPath)
                var flag_2 = detectWxRequest(targetPath)
                var flag_3 = detectCompatibilityUsage(targetPath)
                if (flag_2['flag']){
                    var value_all = {"ProjectName": projectName, "adapt_System":flag_1, "dataMisuse":flag_2['_dataList'], 'compatibility':JSON.stringify(flag_3)}
                    resultList_Details.push(value_all)
                    var value = {"ProjectName": projectName, "adapt_System":flag_1, "dataMisuse":flag_2['flag'], 'compatibility':JSON.stringify(flag_3)}
                    resultList.push(value)
                }else{
                    var value = {"ProjectName": projectName, "adapt_System":flag_1, "dataMisuse":flag_2['flag'], 'compatibility':JSON.stringify(flag_3)}
                    resultList.push(value)
                }
            }
        }
    }

    var analysisFile = path.join('Result_Unknown.json')
    if (fs.existsSync(analysisFile)){
        del.sync(analysisFile)
    }
    fs.writeFileSync('Result_Unknown.json', JSON.stringify(resultList))

    var endTime = new Date().getTime();
    
    var ans = timeDiffStr({
    startDate: startTime,
    endDate: endTime,
    options: {
        extraConfig: {
        lang: 'en',
        upper: 'first'
        }
    },
    });
    
    console.log(tynt.Red("Cost time: "+ans));
}

detectUnknownBugs()


