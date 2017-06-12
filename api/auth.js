import Config from '../config';
import Jwt from 'jwt-simple';
import User from '../mongoDB/models/user';
import Image from '../mongoDB/models/image';
import FB from 'fb';
import Fs from 'fs';
//import Download from 'image-downloader';
import Request from 'request';

function download(uri, filename, callback){
    Request.head(uri, function(err, res, body){
 //   console.log('content-type:', res.headers['content-type']);
 //   console.log('content-length:', res.headers['content-length']);

    //Request(uri).pipe(Fs.createWriteStream(filename)).on('close', callback);

        Request(uri).pipe(Fs.createWriteStream(filename)).on('close', callback);
  });
};
/*function download(uri, callback){
    Request.head(uri, function(err, res, body){
        Request(uri).on('close', callback);
    });
};*/
function handleError(err, res) {
    console.log(err + " in UserAPI");
    if(!err){
        err = "NO DATA";
        return res.status(400).json({error: err});
    }
    if(err.errmsg) {
        res.status(400).json({error: err.errmsg});
    } else {
        res.status(400).json({error: err});
    }
}

function handleSuccess(res) {
   res.json({suc: "ok"});
}


function createToken(_id) {
    return Jwt.encode({_id: _id}, Config.secret);
}

export default class Authentication {
    
    static login(req, res) {
        const account = req.body.account;
        const password = req.body.password;
        if(!account || !password || account.length < 5 || password.length < 8) {
            return handleError("non-valid input", res);
        }
        User.findOne({account: account, password}, 
        (err, user) => {
            if(err || !user) {
                return handleError(err, res);
            }
            res.json({token: createToken(user._id), _id: user._id}); 
        });
    }
    static loginByFB(req, res) {
        const access_token = req.body.access_token;
        
        const client_id = Config.FBApp.ID;
        const client_secret = Config.FBApp.secret;
        var url= "";

        if(!access_token) {
            return handleError("non-valid input", res);
        }

        //get app token from fb
        url = "oauth/access_token";
        url = url + "?client_id=" + client_id;
        url = url + "&client_secret=" + client_secret;
        url = url + "&grant_type=" + "client_credentials";        
        FB.api(url, (resApp) => {
            if(resApp.error || !resApp.access_token) return handleError(resApp.error, res);
            url = "debug_token";
            url = url + "?input_token=" + access_token;
            url = url + "&access_token=" + resApp.access_token;

            FB.api(url, (fbres) => {
                if(!fbres || !fbres.data || !fbres.data.is_valid){
                    console.log(fbres);
                    return handleError("token non valid", res);
                }
                User.findOne({fbID: fbres.data.user_id}, "_id", (err, user) => {
                    if(err) return handleError(err, res);
                    if(user){
                        res.json({token: createToken(user._id), _id: user._id}); 
                    } else {
                        //get User information
                        url = fbres.data.user_id +  "?fields=id, name, gender, picture.type(large)";
                        url = url + "&access_token=" + resApp.access_token;
                        FB.api(url, (fbres) => {
                            console.log(fbres);
                            if(fbres.error) return handleError(fbres.error.message, res);
                            //register new user
                            download(fbres.picture.data.url, fbres.id , () => {
                            //console.log("download");
                            //download(fbres.picture.data.url, (data) => {
                            const data = Fs.readFileSync(fbres.id);
                           // console.log("done");
                            Fs.unlinkSync(fbres.id);
//                            console.log(data);
                            Image.create({data: data}, (err, pic) => {
                                    if(err) {
                                        return handleError(err, res);
                                    }
                                    User.create({account: fbres.id, fbID: fbres.id, name: fbres.name, gender: fbres.gender, profilePic: pic._id}, (err, user) => {
                                        if(err) return handleError(err, res);
                                        res.json({token: createToken(user._id), _id: user._id}); 
                                    });
                                });
                            });
                            
                        });
                    }
                });
            });
        });
    }
    static auth(req, callback) {
        const token = req.headers.authorization;
        if(!token) {
            return callback(new Error("token is NULL"));
        } 
        try {
            const decoded = Jwt.decode(token, Config.secret);
            return callback(null, decoded);
        } catch (err) {
            return callback(new Error("Signature verification failed"), {});
        }
    }
}
