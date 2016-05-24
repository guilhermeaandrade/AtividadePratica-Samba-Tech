var express = require('express');
var body_parser = require('body-parser');
var http = require('http');
var path = require('path');
var aws = require('aws-sdk');
var Zencoder = require('zencoder');

var app = express();

//Configurações da aplicação
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(body_parser.urlencoded({ extended: true }));
app.get('/', function(request, response) {
    response.render('pages/index');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

//upload S3
//*****************************************************************************************************
var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
var S3_BUCKET = process.env.S3_BUCKET;

app.get('/sign_s3', function(req, res){
    aws.config.update({
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
        httpOptions: {
           timeout: 3600000,
        },
      });
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

//zencoder
//*****************************************************************************************************
app.get('/zencoder', function(req, res){
    var client = new Zencoder('aecec04ea8904ffcadee0cb7a1597790');
    console.log("url: "+req.query.url);
    console.log("file_name: " + req.query.file_name);
    client.Job.create({
        input: req.query.url,
        outputs: [{
            url: 's3://'+S3_BUCKET+'/'+req.query.file_name,
            size: "640x480",
        }],
        test: false,
    }, function(err, data){
        var response = 0;
        if(err){
            console.log("Erro com a conversão!");
            return err;
        }else{
            response = poll(data.id, client);
        }
        console.log('Job created!\nJob ID: ' + data.id);
        res.write(JSON.stringify(""+response));
        res.end();
    });
});

function poll(id, client) {
  console.log("entrei no metodo poll");
  setTimeout(function(){
    client.Job.progress(id, function(err, data) {
      if (err) { console.log("OH NO! There was an error"); return err; }
      if (data.state == 'waiting') {
        if (!this.status || this.status != 'waiting') { //processo esperando
            this.status = 'waiting';
            console.log("Waiting");
        }
        poll(id, client);
      } else if (data.state == 'processing') { //processo em andamento
          var progress = Math.round(data.progress * 100) / 100;
          this.status = 'processing';
          console.log('Processando '+ progress + "%");
          poll(id, client);
      } else if (data.state == 'finished') { //processo finalizado
        console.log('Job finished!');
        return 1;
      }
    });
  }, 5000);
}
