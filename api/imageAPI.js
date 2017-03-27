import Image from '../mongoDB/models/image';

function handleError(err, res) {
    console.log(err + " in ImageAPI");
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

export default class ImageAPI {
    
    static getImage(req, res) {
        const id = req.query.id;
        if (!id) {
            return handleError("non-valid input", res);
        }
        Image.findOne({_id: id}, (err, image) => {
            if(err || !image){
                return handleError(err, res);
            }
            res.send(
		image.data
            );
        });
    }
    
}
