import Mongoose from 'mongoose';

export default class Utility {
    static transMongoID(_id){
        return _id ? Mongoose.Types.ObjectId(_id) : null;
    }
    static transCompleteAddress(_id) {
        return _id ? "http://tronzo.asia:3000/get/image?id=" + _id : null;
    }
    static handleError(err, res) {
        console.log(err);
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
    static handleSuccess(suc, res) {
        suc.suc = "OK";
        res.json(suc);
    }  
}
