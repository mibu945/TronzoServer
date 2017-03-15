import User from '../mongoDB/models/user';
import Auth from './auth';

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

export default class UserAPI {
    
    //取得基本資訊
    static getUserByAccount(req, res) {
        const account = req.query.account;
        if (!account) {
            return handleError("non-valid input", res);
        }
        User.findOne({account: account}, (err, user) => {
            if(err || !user){
                return handleError(err, res);
            }
            res.json({
                _id: user._id,
                account: user.account,
                describe: user.describe,
                follows: user.follows
            });
        });
    }
    //取得基本資訊
    static getUserByID(req, res) {
        const account = req.query.userID;
        if (!userID) {
            return handleError("non-valid input", res);
        }
        User.findOne({_id: userID}, (err, user) => {
            if(err || !user){
                return handleError("input is null", res);
            }
            res.json({
                _id: user._id,
                account: user.account,
                describe: user.describe,
                follows: user.follows
            });
        });
    }

    //註冊新用戶
    static postUser(req, res){
        const account = req.body.account;
        const password = req.body.password;

        /* Check the inputs is valid */
        var isValid = true;
        if(!account || !password) isValid = false;
        if(isValid) {
            if(account.length < 5 || account.length > 15) isValid = false;
            if(password.length < 8 || password.length > 15) isValid = false;
        }
        if(!isValid) {
            return handleError("non-valid input", res);
        } 

        const newUser = new User({account: account, password: password});
        newUser.save((err, user) => {
            if(err) {
                return handleError(err, res);
            } 
            return handleSuccess(res);
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
                return handleSuccess(res);
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
            if(err) {
               return handleError(err, res);
            }
            User.update({_id: token._id}, {$addToSet: {follows: userID}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess(res);
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
                return handleSuccess(res);
            });        
        });
    }

    //收藏某book
    static putCollectBook(req, res) {
        const bookID = req.body.bookID;
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            User.update({_id: token._id}, {$addToSet: {collections: bookID}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess(res);
            });        
        });
    }
    //取消收藏
    static putCancelCollectBook(req, res){
        const bookID = req.body.bookID;
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            User.update({_id: token._id}, {$pull: {collections: bookID}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess(res);
            });        
        });
    }
}
