import Config from '../config';
import Jwt from 'jwt-simple';
import User from '../mongoDB/models/user';

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
        if(!account || !password) {
            return handleError("non-valid input", res);
        }
        User.findOne({account: account, password}, 
        (err, user) => {
            if(err || !user) {
                return handleError(err, res);
            }
            res.json({token: createToken(user._id)}); 
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
            return callback(new Error("Signature verification failed"));
        }
    }
}
