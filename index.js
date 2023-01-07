const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
var httpProxy = require("http-proxy");
var express = require("express");
var readlineSync = require("readline-sync");
const process = require("process");
const exec = require("child_process").exec;
const Os = require("os");
var platform;

const endpoint = "https://www.archives.gov/research/jfk/release2022";
const base = "https://www.archives.gov";
const numPages = 265;
const portNum = 3220;

async function serverSetUp() {
  const proxyServer = httpProxy.createProxyServer({});
  const app = express();

  try {
    console.log("setting up server...");
    app.get("*", function (req, res) {
      proxyServer.web(req, res, {
        target: `${req.protocol}://${req.hostname}`
      });
    });
  } catch (err) {
    console.log(err);
  }
  //use port 3220
  const Server = await app.listen(portNum);
}

function pdfHandler(page, body, pdf, num) {
  var promise = new Promise(function (resolve, reject) {
    //const i1=i;
    setTimeout(function () {
      var link = `${base}${pdf.attr("href")}`;
      var filename = link.toString().split("/").reverse()[0];
      // console.log(`filename: ${filename}`);
      // console.log(`link: ${link}`);

      var options = {
        url: link,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Connection: "Keep-Alive"
        },
        proxy: {
          host: "localhost",
          port: portNum
        },
        //need stream to be able to pipe
        responseType: "stream"
      };

      axios(options)
        .then(function (res) {
          const file = fs.createWriteStream(`pdf_files/${filename}`);
          res.data.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve(`File: ${filename} downloaded!`);
          });
        })
        .catch(function (err) {
          console.log("Error: ", err);
          reject(`Error: ${err}`);
        });
    }, 3000 * num);
  });
  return promise;
}

function getPage(endpoint, page) {
  var options = {
    url: endpoint + `?page=${page}`,
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Connection: "Keep-Alive"
    },
    proxy: {
      host: "localhost",
      port: portNum
    }
  };

  var promises = [];
  var loopPromise;

  loopPromise = new Promise(function (resolve, reject) {
    axios(options).then(function (response) {
      var data = response.data;
      var body = cheerio.load(data);

      var tableBody = body(".table-hover tbody");
      var headers = body(".table-hover th");

      var num = 0;
      body("tr", tableBody).each(function (i, el) {
        var row = body(el);
        body("td", el).each(function (i, el) {
          var pdf = body(el).find("a");
          if (pdf != null && pdf != "") {
            var promise = pdfHandler(page, body, pdf, num);
            promises.push(promise);
            num++;
          }
        });
      });

      console.log(promises.length);
      for (var i = 0; i < promises.length; i++) {
        const promise = promises[i];
        const i1 = i;
        promise.then(function (response) {
          console.log(`res: ${response}`);
          if (i1 == promises.length - 1) {
            setTimeout(function () {
              resolve(`Loop ${page} finished...`);
            }, 1000);
          }
        });
      }
    });
  });
  return loopPromise;
}

async function batchDownload() {
  for (var i = 0; i <= 0; i++) {
    const i1 = i;

    await getPage(endpoint, i1).then(function (response) {
      console.log(response);
    });
    menu();
  }
}

function menu() {
  console.log(
    "\n\n\nCommands\nrun: run batch download\ndelete: delete pdf files\nexit: exit program\n\n\n"
  );
  var runBatchDownload = readlineSync.question("Enter command: ");
  if (runBatchDownload == "run") {
    console.log("running...");
    batchDownload();
  } else if (runBatchDownload == "delete") {
    console.log("deleting files...");
    if (platform == "win32") {
      exec("del pdf_files/*.pdf");
    } else if (platform == "linux") {
      exec('find pdf_files -type f -iname "*.pdf" -delete');
    }
    menu();
  } else if (runBatchDownload == "exit") {
    console.log("exiting...");
    process.exit(0);
  } else {
    console.log("Please enter a valid command...");
    menu();
  }
}

platform = Os.platform();
console.log(`\n\n\nPlatform: ${platform}\n\n\n`);

serverSetUp();
menu();
