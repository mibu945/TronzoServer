import Book from '../mongoDB/models/book';
import User from '../mongoDB/models/user';
import Image from '../mongoDB/models/image';
import Auth from './auth';
import Fs from 'fs';
import Ip from 'public-ip';
import Async from 'async';
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

function handleSuccess(suc, res) {
    suc.suc = "ok";
    res.json(suc);
}

function findUser(userID, loginID, cb) {
    Async.parallel([
        function(cb) {
            User.findOne({_id: userID}, cb);
        },
        function(cb) {
            Ip.v4().then((ipv4) => {cb(null, ipv4)});
        },
        function(cb) {
            Book
            .find({author: userID})
            .populate("sections", "wordCnt")
            .exec(cb);
        },
        function(cb) {
            User.find({follows: {$in: [userID]}}, "_id", cb);
        },
        function(cb){
            if(loginID)User.findOne({_id: loginID}, "follows", cb);
            else cb(null, null);
        }
    ], (err, res) => {
        if(err) {
            return cb(err, null);
        }
        const user = res[0];
        const ip = res[1];
        const books = res[2];
        const followNum = res[3].length;
        var LoginUserFollowUsers;
        if(res[4])LoginUserFollowUsers = res[4].follows;
        else LoginUserFollowUsers = [];
        var resUser = {};
        resUser._id = user._id;
        resUser.name = user.name;
        resUser.description = user.description;
        if(user.profilePic) {
            resUser.profilePic = "http://" + ip + ":3000/get/image?id=" + user.profilePic;
        }
        resUser.rank = user.rank;
        resUser.books = books.length;
        resUser.likes = books.reduce((sum, book) => {
            sum += book.likeUsers.length;
            return sum;
        }, 0);
        resUser.stores = books.reduce((sum, book) => {
            sum += book.storeUsers.length;
            return sum;
        }, 0);

        resUser.readNum = books.reduce((sum, book) => {
            sum += book.readCnt;
            return sum;
        }, 0);
        resUser.wordCnt = books.reduce((sum, book) => {
            sum += book.sections.reduce((sum2, section) => {
                sum2 += section.wordCnt;
                return sum2;
            }, 0);
            return sum;
        }, 0);
        resUser.follows = followNum;
        resUser.isFollow = false;
        var index = LoginUserFollowUsers.indexOf(userID);
        if(index > -1) {
            resUser.isFollow = true;
        }
        //resUser.bookHistorys = user.bookHistorys;
        cb(null, resUser);
    });
}

function dataURItoBlob(dataURI, type) {
    // convert base64 to raw binary data held in a string
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    var bb = new Blob([ab], { type: type });
    return bb;
}
export default class UserAPI {
    
    static getUser(req, res) {
        Auth.auth(req, (err, token) => {
            if(err) {
                return handleError(err, res);
            }
            findUser(token._id, token._id , (err, user) => {
                if(err) {
                    return handleError(err, res);
                }
                res.json(user);  
            });
        });
    }
    

    static getUserByID(req, res) {
        const userID = req.query.userID;
        if (!userID) {
            return handleError("non-valid input", res);
        }
      
        Auth.auth(req, (err, token) => {
            var id = ""
            if(err) id = null;
            else id = token._id;
            findUser(userID, id, (err, user) => {
                
                if(err) {
                    return handleError(err, res);
                }
                res.json(user);  
            });
        });
    }

    //register
    static postUser(req, res){
	    const name = req.body.name;
        const account = req.body.account;
        const password = req.body.password;
	    const birthday = req.body.birthday;
	    const gender = req.body.gender;

        /* Check the inputs is valid */
        var isValid = true;
        if(!account || !password || !name ) isValid = false;
        if(isValid) {
            if(account.length < 5) isValid = false;
            if(password.length < 8 || password.length > 15) isValid = false;
        }
        if(!isValid) {
            return handleError("non-valid input", res);
        }
        var user = {};
        user.name = name;
        user.account = account;
        user.password = password;
        if(birthday) user.birthday = birthday;
        if(gender) user.gender = gender;
        User.findOne({account: user.account}, (err, ans) => {
            if(ans || err) return handleError("same account", res);
            User.create(user, (err, user2) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({_id: user2._id}, res);
            });
        });
        
    }   

    //修改基本資料
    static putUser(req, res) {
        //Updated data
        const description = req.body.description;
        if(!description) {
            return handleError("non-valid input", res);
        }

        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            User.update({_id: token._id}, {$set: {description: description}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });
        }); 
    }

    static putUserProfilePic(req, res) {
        var pic = req.body.profilePic;
        if(!pic) {
            return handleError("non-valid input", res);
        }
        pic = new Buffer(pic.split(",")[1], 'base64');
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            User.findOne({_id: token._id}, "profilePic", (err, user) => {
                if(err || !user){
                    return handleError(err, res);
                }
                //const data = Fs.readFileSync(pic.path);
	            const data = pic;
                Image.create({data: data}, (err, pic2) => {
                    if(err) {
                        return handleError(err, res);
                    }
                    if(user.profilePic){
                        Image.remove({_id: user.profilePic});
                    }
                    User.update({_id: token._id}, {$set: {profilePic: pic2._id}}, (err) => {
                        if(err) {
                            return handleError(err, res);
                        }
                        return handleSuccess({}, res);
                    });
                }); 
            });
	    });
    }

    //追隨其他user
    static putFollowUser(req, res) {
        //followed id
        const userID = req.body.userID;
        if(!userID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err || userID == token._id) {
               return handleError(err, res);
            }
            User.update({_id: token._id}, {$addToSet: {follows: userID}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });        
        });
    }
    //取消追蹤某人
    static putCancelFollowUser(req, res){
        //followed id
        const userID = req.body.userID;
        if(!userID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            User.update({_id: token._id}, {$pull: {follows: userID}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });        
        });
    }
}
