var express = require('express');
var bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.static(__dirname+'/public'));

var cors = require('cors')();
app.use(cors);

var mysql = require('mysql');
var mongodb = require('mongodb');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'test1234',
  database : 'restful'
});
 
connection.connect();

var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/restful';
var dbobj = null;
// Use connect method to connect to the Server 
MongoClient.connect(url, function(err, db) {
  console.log("Connected correctly to server");
  dbobj = db;
});


var multer = require('multer');
var Storage = multer.diskStorage({
     destination: function(req, file, callback) {
         callback(null, "./public/upload_image/");
     },
     filename: function(req, file, callback) {
     		file.uploadedFile = file.fieldname + "_" + 
     			Date.now() + "_" + file.originalname;
     		console.log('file.uploadedFile:'+file.uploadedFile);
         callback(null, file.uploadedFile);
     }
 });
 var upload = multer({
     storage: Storage
 }).single("image");
app.post('/user/picture',function(req, res) {
	upload(req, res, function(err) {
		if (err) {
			res.send(JSON.stringify(err));
		} else {
			res.send(JSON.stringify({url:req.file.uploadedFile,
				description:req.body.description}));
		}
	});
});

app.get('/user/message',function(req,res){
   console.log(req.query.sender_id);
   var condition = {};
   if (req.query.sender_id != undefined)
   	   condition = {sender_id:req.query.sender_id};
   var messages = dbobj.collection('messages');
   messages.find(condition).toArray(function(err,results){
   	if(err){
   		res.send(JSON.stringify(err));
   	} else {
   		res.send(JSON.stringify(results));
   	}
   });
});

var ObjectID = require('mongodb').ObjectID;
app.get('/user/message/:id',function(req,res){
    var messages = dbobj.collection('messages');
    console.log(req.params.id);
    messages.findOne(
    	{_id:ObjectID.createFromHexString(req.params.id)},
    	function(err,result){
    		if(err){
    			res.send(JSON.stringify(err));
    		} else {
    			res.send(JSON.stringify(result));
    		}
    	});
});

app.post('/user/message',function(req,res){
	console.log(req.body.sender_id);
	console.log(req.body.reciever_id);
	console.log(req.body.message);
	connection.query('select id,name from user where id=? or id=?',
		[req.body.sender_id,req.body.reciever_id],
		function(err,results,field){
			if(err){ 
				res.send(JSON.stringify(err));
			} else {
				var sender = {};
				var reciever = {};
				for (var i = 0; i < results.length; i++){
					if (results[i].id == Number(req.body.sender_id)){
						sender = results[i];
					}

					if(results[i].id == Number(req.body.reciever_id)){
						reciever = results[i];
					}
				}

				var object = {
					sender_id:req.body.sender_id,
					reciever_id:req.body.reciever_id,
					sender:sender,reciever:reciever,
					message:req.body.message,
					created_at:new Date()
				}
				var messages = dbobj.collection('messages');
				  messages.save(object, function(err,result){
				  if (err) {
				  	res.send(JSON.stringify(err));
				  } else {
				  	res.send(JSON.stringify(result));
				  }
			  });
		}

   });

});	
app.delete('/user/message/:id',function(req,res){
    var messages = dbobj.collection('messages');
    messages.remove(
    	{_id:ObjectID.createFromHexString(req.params.id)},
    	function(err,result){
    		if(err){
    			res.send(JSON.stringify(err));
    		} else {
    			res.send(JSON.stringify(result));
    		}
    	});
});

var users = [];
app.get('/user',function(req,res){
	//res.send(JSON.stringify(users));
	connection.query('select * from user',function(err,results,fields){
		if (err){
			res.send(JSON.stringify(err));
		} else {
			res.send(JSON.stringify(results));
		}
	});
});



app.get('/user/:id',function(req,res){
	connection.query('select * from user where id=?',[req.params.id],
		function(err,results,fields){
			if (err){
		    	res.send(JSON.stringify(err));
	    	} else {
	    		if (results.length > 0) {
	    			results[0].city = '서울';
                    res.send(JSON.stringify(results[0]));
	    		} else{
			       
			        res.send(JSON.stringify({}));
			    }
		    }

		});


}); 


var crypto = require('crypto');
app.post('/user',function(req,res){
    var password = req.body.password;
    var hash = crypto.createHash('sha256').
             update(password).digest('base64');
	connection.query('insert into user(user_id,password,alias,name,age) values(?,?,?,?,?)',
		[ req.body.user_id, hash,req.body.alias,req.body.name,req.body.age ],
		function(err,result){
			if (err) {
				res.send(JSON.stringify(err));
			} else
			{
				res.send(JSON.stringify(result));
			}
		});  
});

// 로그인
var jwt = require('json-web-token');
app.post('/user/login',function(req,res){ 
	var password = req.body.password;
	var hash = crypto.createHash('sha256').
             update(password).digest('base64');
    connection.query('select id,alias from user where user_id = ? and password = ?',
        [ req.body.user_id,hash],  function(err,results,field){
        	if (err) {
                res.send(JSON.stringify(err));
        	} else {
        		if(results.length > 0) { // 로그인 성공
        			var cur_date = new Date();
        			var settingAddHeaders = {
        				payload: {
        					"iss":"shinhan",
        					"aud":"mobile",
        					"iat":cur_date.getTime(),
        					"typ":"/online/transactionstatus/v2",
        					"request":{
        						"myTransactionId":req.body.user_id,
        						"merchantTransationId":hash,
        						"status":"SUCCESS"
        					}
        				},
        				header:{
        					kid:'abcefghijklmnopqrstuvwxyz123456789'
        				}
        			};
        			var secret = "SHINHANMOBILETOPSECRET!!!!!";
        			// 고유한 토큰 생성
        			jwt.encode(secret, settingAddHeaders,
        				function(err,token){
        					if(err) {
        						res.send(JSON.stringify(err));
        					} else {
        						var tokens = token.split(".");
        						connection.query(
        							'insert into user_login('+
        							  'token,user_real_id) values(?,?)',
        							  [tokens[2], results[0].id],
        							  function(err,result) {
        							  	if(err) {
        							  		res.send(JSON.stringify(err));
        							  	} else {
                                            res.send(JSON.stringify({
                                            	result:true,
                                            	token:tokens[2],
                                            	db_result:result,
                                            	id:results[0].id,
                                            	alias:results[0].alias
                                            }));
        							  	}
        							  });
        						//res.send(JSON.stringify({result:true, token:tokens[2]}));
        					}
        				});
                 //   res.send(JSON.stringify({result:true}));
        		} else {
        			res.send(JSON.stringify({result:false}));

        		}
        	}
        });       
});

//회원가입
app.post('/user/signup',function(req,res){ 
	console.log(req.body.user_id);
	console.log(req.body.password);
	console.log(req.body.alias);	
    var password = req.body.password;
    var hash = crypto.createHash('sha256').
             update(password).digest('base64');
	connection.query('insert into user(user_id,password,alias) values(?,?,?)',
		[ req.body.user_id, hash,req.body.alias ],
		function(err,result){
			if (err) {
				res.send(JSON.stringify({result:false}));
			} else
			{
				res.send(JSON.stringify({result:true}));
			}
		});  
});

//회원탈퇴
app.delete('/user/withdraw',function(req,res){ 
	//console.log(req.body.user_id);
	//console.log(req.body.password);
	var password = req.body.password;
	var hash = crypto.createHash('sha256').
             update(password).digest('base64');
    connection.query('select id from user where user_id = ? and password = ?',
        [ req.body.user_id,hash],  function(err,results,field){
        	if (err) {
                
                res.send(JSON.stringify({result:false}));
        	} else
        	{
        		if(results.length > 0) {
	        		console.log(results[0].id);
	        		connection.query('delete from user where id=?',
		        	   [ results[0].id ],function(err,result) {
			    	   if(err) {
				    	   res.send(JSON.stringify({result:false}));
				       } else {
					       res.send(JSON.stringify({result:true}));
				       }
				     });
        	     } else
        	     {
        			res.send(JSON.stringify({result:false}));        	     	
        	     }
			 } 
		});
});

app.put('/user/:id',function(req,res){
	connection.query(  
		'update user set name=?,age=? where id=?',
		[ req.body.name, req.body.age , req.params.id ],
		function(err,result){
			if(err) {
				res.send(JSON.stringify(err));
			} else {
				res.send(JSON.stringify(result));
			}
		});
	
});


app.delete('/user/:id',function(req,res){ 
	connection.query('delete from user where id=?',
		[ req.params.id ],function(err,result) {
			if(err) {
				res.send(JSON.stringify(err));
			} else {
				res.send(JSON.stringify(result));
			}
		});
});

// 게시판
app.get('/post',function(req,res){
	//res.send(JSON.stringify(users));
    connection.query('select a.*,ifnull(b.cnt,0) cnt from request_list a left join(select request_id,count(*) cnt from commend_list group by request_id) b on a.id = b.request_id order by id desc',function(err,results,fields){
	//connection.query('select * from request_list order by id desc',function(err,results,fields){
		if (err){
			res.send(JSON.stringify(err));
		} else {
			res.send(JSON.stringify(results));
		}
	});
});

app.get('/post/:id',function(req,res){
	connection.query('select a.*,ifnull(b.cnt,0) cnt from (select * from request_list where id = ?) a left join(select request_id,count(*) cnt    from commend_list  group by request_id) b   on a.id = b.request_id',[req.params.id],
		function(err,results,fields){
			if (err){
		    	res.send(JSON.stringify(err));
	    	} else {
	    		if (results.length > 0) {
                    res.send(JSON.stringify(results));
	    		} else{
			       
			        res.send(JSON.stringify({}));
			    }
		    }

		});

}); 

app.post('/post',function(req,res){ 
	console.log(req.body.user_real_id);
	console.log(req.body.alias);
	console.log(req.body.image_no);
	console.log(req.body.message);	
	connection.query('insert into request_list(user_real_id,alias,image_no,message) values(?,?,?,?)',
		[ req.body.user_real_id, req.body.alias,req.body.image_no, req.body.message],
		function(err,result){
			if (err) {
				res.send(JSON.stringify({result:false}));
			} else
			{
				res.send(JSON.stringify({result:true}));
			}
		});  
});

app.put('/post/:id',function(req,res){
	connection.query(  
		'update request_list set message=? where id=?',
		[ req.body.message , req.params.id ],
		function(err,result){
			if(err) {
				res.send(JSON.stringify(err));
			} else {
				res.send(JSON.stringify(result));
			}
		});
	
});

app.delete('/post/:id',function(req,res){ 
	connection.query('delete from request_list where id=?',
		[ req.params.id ],function(err,result) {
			if(err) {
				res.send(JSON.stringify(err));
			} else {
				res.send(JSON.stringify(result));
			}
		});
});

// 댓글
app.get('/commend/:id',function(req,res){
	console.log("commend");
		console.log(req.params.id);
	connection.query('select * from commend_list where request_id=?',[req.params.id],
		function(err,results,fields){
			if (err){
		    	res.send(JSON.stringify(err));
	    	} else {
	    		if (results.length > 0) {
                    res.send(JSON.stringify(results));
	    		} else{
			       
			        res.send(JSON.stringify({}));
			    }
		    }

		});
}); 

app.post('/commend',function(req,res){ 
	console.log(req.body.user_real_id);
	console.log(req.body.request_id);
	console.log(req.body.message);	
	connection.query('insert into commend_list(user_real_id,request_id,message) values(?,?,?)',
		[ req.body.user_real_id, req.body.request_id,req.body.message],
		function(err,result){
			if (err) {
				res.send(JSON.stringify({result:false}));
			} else
			{
				res.send(JSON.stringify({result:true}));
			}
		});  
});

app.delete('/commend/:id',function(req,res){ 
	connection.query('delete from commend_list where id=?',
		[ req.params.id ],function(err,result) {
			if(err) {
				res.send(JSON.stringify(err));
			} else {
				res.send(JSON.stringify(result));
			}
		});
});

app.listen(52273,function(){
	console.log('Server running');
}); 