
var http = require('http');
var aws = require('aws-sdk');
var async = require('async');
var fs = require('fs');
var aws_cfg_file = "./config.json";
var queueUrl = "https://sqs.us-west-2.amazonaws.com/983680736795/matusiakSQS";
var lwip = require('lwip');

aws.config.update({ region: 'us-west-2' });

async.whilst(
    function () { return true },
    function (callback) {
        params = {
            QueueUrl: queueUrl,
            AttributeNames: ['All'],
            VisibilityTimeout: 0,
            WaitTimeSeconds: 20
        };
        var sqs = new aws.SQS();
        sqs.receiveMessage(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else {

                console.log(data);
                if (typeof data.Messages != "undefined") {
                    var operations = JSON.parse(data.Messages[0].Body);
                    params = {
                        QueueUrl: queueUrl,
                        ReceiptHandle: data.Messages[0].ReceiptHandle
                    };
                    downloadFile(operations['file'], function (err, info) {
                        console.log(err + ": " + info);
                        //sendNotification();
                        prepareFile(operations, function (data) {
                            if (data) {
                                console.log(data);
                                var parameters = {
                                    key: operations.file,
                                    filename: data
                                };
                                sendToS3(parameters, function (err, notes) {
                                    if (err)
                                        console.log(err + ": " + notes);
                                    else
                                        console.log(notes);
                                });
                            }
                            else {
                                console.log(data);
                            }
                        });
                    });
                    sqs.deleteMessage(params, function (err, data) {
                        if (err) console.log(err, err.stack);
                        else console.log(data);
                        callback();
                    });
                } else {
                    callback();
                }
            }
        });
    },
    function (err, n) {
    }
);

var sendNotification = function (){
    var ses = new aws.SES();
    var maildata = {
        Destination: {
            ToAddresses: [
                "azamennace@gmail.com"
            ]
        },
        Message: {
            Body: {
                Text: {
                    Data: "Your file has been received"
                }
            },
            Subject: {
                Data: "Notification"
            }
        },
        Source: "206385@edu.p.lodz.pl"
    }
    ses.sendEmail(maildata, function (err, data) {
        if (err) console.log(err);
        else console.log("Mail was sent to " + maildata.Destinations[0]);
    });
}

var sendToS3 = function (parameters, callback){
    var s3 = new aws.S3();
    var uploadParams = {
        ACL: "private",
        Bucket: 'mariusz.matusiak',
        Key: parameters.key,
        Body: fs.readFileSync(parameters.filename)
    };
    s3.putObject(uploadParams, function (err, data) { 
        if (err)
            callback(err, err.stack);
        else
            callback(null, data);
    });
}

var downloadFile = function (key, callback){
    var s3 = new aws.S3();
    var params = {
        Bucket: 'mariusz.matusiak',
        Key: key
    };
    s3.getObject(params, function (err, data) {
        if (err) callback(err, err.stack);
        else {
            var pos = key.lastIndexOf("/");
            var path = key.substring(pos+1);
            fs.writeFileSync(path, data.Body);
            callback(null, path);
        }
    });
}

var prepareFile = function (operations, callback){
    var filename = operations.file.substring(operations.file.lastIndexOf("/") + 1);
    lwip.open(filename, function (err, image) {
        var batch = image.batch();
        if (typeof operations.blur != "undefined") {
            batch.blur(parseInt(operations.blurvalue));
        }
        if (typeof operations.flip != "undefined") {
            batch.mirror(operations.flipdir);
        }
        if (typeof operations.resize != "undefined") {
            batch.scale(parseFloat(operations.resizerange));
        }
        if (typeof operations.rotate != "undefined") {
            batch.rotate(parseInt(operations.rotaterange));
        }
        batch.writeFile("out_" + filename, function (err) {
            console.log(err);
            if (err)
                callback(null);
            else
                callback("out_" + filename);
        });
    });
}

var port = process.env.port || 8081;
http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Worker\n');
}).listen(port);

