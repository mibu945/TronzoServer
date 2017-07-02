import Image from '../mongoDB/models/image';
import Utility from './utility';

export default class ImageAPI {
    
    static getImage(req, res) {
        const id = req.query.id;
        if (!id) return Utility.handleError("non-valid input", res);
        Image.findOne({_id: id}, (err, image) => {
            if(err || !image) return Utility.handleError(err, res);
            res.send(image.data);
        });
    }
}
