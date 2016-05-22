var express = require('express');
var body_parser = require('body-parser');
var http = require('http');
var path = require('path');
var fs = require('fs');
var zlib = require('zlib');

//upload S3
//definindo variáveis de acesso
var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
var S3_BUCKET = process.env.S3_BUCKET;

var aws = require('aws-sdk');

var app = express();

//zencoder
var Zencoder = require('zencoder');
var client = new Zencoder('aecec04ea8904ffcadee0cb7a1597790');
client.Job.create({
  input: 'https://s3-sa-east-1.amazonaws.com/apsambatech/test1.wmv',
  outputs: [{
      url: "s3://apsambatech/test1_converted.mp4",
      size: "640x480"
    },
    {
      url: "s3://apsambatech/test1_converted.webm",
      size: "640x480"
    }
  ]
}, function(err, data){
  if (err) { console.log("Erro com a conversão!"); return err; }
  console.log('Job created!\nJob ID: ' + data.id);
  poll(data.id);
});

function poll(id) {
  setTimeout(function(){
    client.Job.progress(id, function(err, data) {
      if (err) { console.log("OH NO! There was an error"); return err; }
      if (data.state == 'waiting') {
        if (!this.status || this.status != 'waiting') {
            this.status = 'waiting'; // set status to waiting so we can start adding dots.
            console.log("Waiting");
        }
        poll(id);
      } else if (data.state == 'processing') {
          var progress = Math.round(data.progress * 100) / 100; // round to nearest decimal places.
          this.status = 'processing'; // not important, but makes sure we don't display waiting again
          console.log('Processando');
          poll(id);
      } else if (data.state == 'finished') {
        console.log('Job finished!'); // finished!
        process.exit(0); // exit
      }
    });
  }, 5000);
}

//Configurações da aplicação
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(body_parser.urlencoded({ extended: true }));
app.get('/', function(request, response) {
    response.render('pages/index');
});

app.post('/', function(request, response){
    response.render('pages/index');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

app.get('/sign_s3', function(req, res){
    aws.config.update({accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY});
    var s3 = new aws.S3();
    var s3_params = {
        Bucket: S3_BUCKET,
        Key: req.query.file_name,
        Expires: 120,
        ContentType: req.query.file_type,
        ACL: 'public-read'
    };
    s3.getSignedUrl('putObject', s3_params, function(err, data){
        if(err){
            console.log(err);
        }
        else{
            var return_data = {
                signed_request: data,
                url: 'https://'+S3_BUCKET+'.s3.amazonaws.com/'+req.query.file_name
            };
            res.write(JSON.stringify(return_data));
            res.end();
        }
    });
});
