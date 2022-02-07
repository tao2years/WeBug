# Characterizing and Detecting Bugs in WeChat Mini-Programs
Built on the WeChat social platform, WeChat Mini-Programs are widely
used by more than 400 million users every day. Consequently, the
reliability of Mini-Programs is particularly crucial. However, WeChat
Mini-Programs suffer from various bugs related to execution
environment, lifecycle management, asynchronous mechanism, etc. These
bugs have seriously affected users' experience and caused serious
impacts.

We conduct the first empirical study on 83 WeChat Mini-Program bugs,
and perform an in-depth analysis of their root causes, impacts and
fixes. From this study, we obtain many interesting findings that can
open up new research directions for combating WeChat Mini-Program
bugs. Based on the bug patterns found in our study, we further develop
WeDetector to detect WeChat Mini-Program bugs. 

## Bug patterns
Our empirical study on WeBugs has revealed several potential patterns
to detect WeBugs. Among them, we summarize three common bug patterns,
i.e., incorrect invocations platform-dependent APIs, incomplete layout
adaptation to anomalous screens, and improper handling of return data
in invoking asynchronous APIs. 

**Pattern 1. Incorrect invocations of platform-dependent APIs.** 
Some APIs in the Mini-Program framework are OS-specific. 
Invoking these platform-dependent APIs without considering different OS can introduce WeBugs. 
Therefore, developers should determine target operating system before using these
APIs. We summarize four kinds of platform-dependent APIs in this table.

## Getting Started
WeDetector - WeChat Mini-Program Bugs Detector
### Development environment
- Windows 10
- Node.js v_12.18.3

- Java v_16

- Babel v_6.26.0
```
npm install -g babel-cli@6.26.0
```

- TAJS  
You should download the jar files from http://www.brics.dk/TAJS/dist/.
 And place it under the folder: dist/tajs-all.jar

### Testing WeChat Mini-Programs
Before running code, you should put projects into folder **benchmarks**.

```
node analyze.js
```

### Publication
If you are interested in our work, you can find more details in our
paper listed below. If you use our dateset and tool, please cite our
paper.

**Characterizing and Detecting Bugs in WeChat Mini-Programs** [//TODO
add paper]

44th IEEE/ACM International Conference on Software Engineering (ICSE'22)

