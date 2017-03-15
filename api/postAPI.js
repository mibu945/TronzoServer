import User from '../mongoDB/models/user';
import Post from '../mongoDB/models/post';

export default class PostAPI {
    static get(req, res) {
        const param = req.query.id;
        if (!param) {
            Post.find({}, (err, doc) => {
                if(err || !doc){
                    console.log(err);
                    res.json([]);
                    return;
                }
                res.json(doc);
            })
            return;
        }
        Post.find({UserID: param}, (err, doc) => {
                if(err || !doc) {
                    console.log(err);
                    res.json([]);
                    return;
                } 
                res.json(doc);
        });     
    }
    static post(req, res){
        const account = req.query.account;
        const password = req.query.password;
        const content = req.query.content;
        
        /* Check the inputs is valid*/
        var isValid = true;
        if(!content)isValid = false;
        if(!isValid){
            res.send("fail");
            return;
        }
        
        /* create a new post*/
        User.findOne({account: account, password: password}, (err, doc) => {
            if(err || !doc) {
                console.log(err);
                res.send("fail");
                return;
            }
            const newPost = new Post({
                userID: doc._id,
                content: content
            });
            newPost.save((err) => {
                if(err) {
                    console.log(err);
                    res.send("fail");
                } else {
                    console.log(content);
                    res.send("success");
                }
            });
        });
    }
    static put(req, res){
        res.send("todo");
    }
    static delete(req, res){
        res.send("todo");
    }
}
