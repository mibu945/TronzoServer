import Post from '../mongoDB/models/post';
import User from '../mongoDB/models/user';
import Book from '../mongoDB/models/book';
import Auth from './auth';
import Ip from 'public-ip';
function handleError(err, res) {
    console.log(err + " in PostAPI");
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

function findPost(req, condition, cb) {
    Post.find(condition)
	.limit(100)
    .populate("author", "name profilePic")
    .populate("book", "cover")
    .exec((err, posts) => {
	    if(err || !posts) {
	        cb(err, posts);
	    } else {
	        Ip.v4().then(ipv4 => {
                var tmp = JSON.parse(JSON.stringify(posts));
                function mapFunction(post) {
                    //console.log(post);
                    if(post.book.cover != null) {
                        post.book.cover = "http://" + ipv4 + ":3000/get/image?id=" + post.book.cover;
                    }
                    if(post.author.profilePic != null) {
                        post.author.profilePic = "http://" + ipv4 + ":3000/get/image?id=" + post.author.profilePic;
                    }
                    return post;
                }
                cb(err, tmp.map(mapFunction));
            });
        }		
	});
}
export default class PostAPI {
    static getPostByID(req, res) {
        const postID = req.query.postID;
        
        if(!postID) {
            return handleError("non-valid input", res);
        }
        findPost(req, {_id: postID}, (err, post) => {
            if(err || !post) return handleError(err, res);
            res.json(post);
        });
    }
    static getPostsByUser(req, res) {
        const userID = req.query.userID;
        if(!userID) {
            return handleError("non-valid input", res);
        }
	    findPost(req, {author: userID }, (err, posts) => {
            if(err || !posts) return handleError(err, res);
            res.json(posts);
        });
    }
    static postPost(req, res) {
        const bookID = req.body.bookID;
        const content = req.body.content;
        if(!bookID || !content) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               console.log("auth fail");
               return handleError(err, res);
            }
            Book.findOne({_id: bookID}, (err, book) => {
                if(err || !book) {
                    return handleError(err, res);
                }
                Post.create({author: token._id, book: bookID, content: content}, (err, post) => {
                    if(err) {
                        return handleError(err, res);
                    }    
                    res.json({_id: post._id})
                }); 
            });
        });
    }
    static putPost(req, res) {
        const postID = req.body.postID;
        const content = req.body.content;
        if(!postID || !content) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Post.update({_id: postID, author: token._id},  {$set: {content: content}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess(res);
            });
        });

    }
    static deletePost(req, res) {
        const postID = req.body.postID;
        if(!postID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Post.remove({_id: postID, author: token._id}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess(res);
            });
        });
    }   
}
